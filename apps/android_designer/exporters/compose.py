"""Compose generator over validated semantic nodes, never Fabric objects."""
import json
from xml.sax.saxutils import escape
from apps.android_designer.domain.model import walk, resolve_screen

PATHS={
'menu':'M3,6 L21,6 M3,12 L21,12 M3,18 L21,18',
'back':'M14,4 L6,12 L14,20 M6,12 L22,12',
'home':'M2,11 L12,2 L22,11 M5,10 L5,22 L19,22 L19,10',
'search':'M20,20 L15,15 M17,10 A7,7 0,1 1,3 10 A7,7 0,1 1,17 10',
'close':'M4,4 L20,20 M20,4 L4,20','settings':'M12,2 L12,22 M2,12 L22,12 M5,5 L19,19 M19,5 L5,19',
'plus':'M12,3 L12,21 M3,12 L21,12'}


def quote(text):return json.dumps(str(text),ensure_ascii=False).replace('$','\\$')


def resource_text(value):
    return escape(str(value).replace('\\','\\\\').replace("'","\\'").replace('"','\\"').replace('\n','\\n'))


class ComposeGenerator:
    def __init__(self,document):
        from apps.android_designer.domain.constraints import layered_screen
        self.doc={**document,'screens':[layered_screen(s) for s in document['screens']]};self.ns=document['namespace'];self.strings={'app_name':document['app_name']};self.files={}

    def color(self,node,key):
        reference=node.get('tokenReferences',{}).get('props.'+key,'')
        if self.doc.get('design_system') and reference.startswith('colors.') and 'props.'+key not in node.get('tokenOverrides',[]):
            from apps.design_system.services.tokens import BASE
            name=reference.split('.',1)[1]
            roles={'background':'background','surface':'surface','surfaceVariant':'surfaceVariant','primary':'primary','secondary':'secondary','accent':'tertiary','textPrimary':'onSurface','textSecondary':'onSurfaceVariant','border':'outline','error':'error'}
            if name in BASE['colors']:
                if self.doc['theme']['dynamicColor'] and name in roles:return 'MaterialTheme.colorScheme.'+roles[name]
                return self.ns+'.ui.theme.AgataTokens.'+name
        from .compose_fidelity import color
        return color(node,key)

    def string(self,node,key,default=''):
        value=node['props'].get(key,default);name=node['id']+'_'+key.lower()
        self.strings[name]=value
        return f'stringResource(R.string.{name})'

    def modifier(self,n):
        from .compose_fidelity import modifier as ordered_modifier
        imported=ordered_modifier(n)
        if imported is not None:return imported
        l=n['layout'];s='Modifier'+n.get('_constraint_modifier','')
        if n.get('_layer'):s+=f".zIndex({float(n['_layer']['order'])}f).graphicsLayer(alpha = {float(n['_layer']['opacity'])}f)"
        if l['margin']:s+=f".padding({l['margin']}.dp)"
        if l['minWidth'] or l['maxWidth']<4096:s+=f".widthIn(min = {l['minWidth']}.dp, max = {l['maxWidth']}.dp)"
        if l['minHeight'] or l['maxHeight']<4096:s+=f".heightIn(min = {l['minHeight']}.dp, max = {l['maxHeight']}.dp)"
        if l['aspectRatio']:s+=f".aspectRatio({float(l['aspectRatio'])}f)"
        for k in ('width','height'):
            value=l[k]
            if value=='fill':s+='.'+('fillMaxWidth()' if k=='width' else 'fillMaxHeight()')
            elif value!='wrap':s+=f'.{k}({value}.dp)'
        if l['weight']:s+=f".weight({float(l['weight'])}f)"
        if l['padding']:s+=f".padding({l['padding']}.dp)"
        if l['scroll']!='none':s+='.'+l['scroll']+'Scroll(rememberScrollState())'
        if n['props'].get('background') and n['type'] in {'Column','Row','Box'}:s+=f".background(Color(0xFF{n['props']['background'][1:]}))"
        if n['events'] and n['type'] not in {'Button','NavigationItem','FloatingButton'}:
            s+=f'.clickable {{ {self.action(n)} }}'
        return s

    def action(self,n):
        e=n['events'].get('onClick',{})
        from apps.android_designer.domain.events import action_kind
        result=f'onAction({quote(action_kind(e))}, {quote(e.get("target",""))})'
        conditions=[]
        for rule in e.get('validation',[]):
            value='v_'+rule['field']
            conditions.append(value+'.isBlank()' if rule['type']=='required' else value+'.length < 6' if rule['type']=='password' else '!android.util.Patterns.EMAIL_ADDRESS.matcher('+value+').matches()')
        if conditions:result='if ('+' || '.join(conditions)+') { onAction("custom", "Preencha os campos corretamente") } else { '+result+' }'
        return f'if (false) {{ {result} }}' if n['type']=='FloatingButton' and not n['props']['enabled'] else result

    def emit(self,n,omit=()):
        if n['id'] in omit or not n['layout']['visible']:return ''
        if n.get('componentDefinition') in {'BottomSheet','Dialog'} and not n.get('_presentation_applied'):
            from .presentation import wrap as presentation
            return presentation(self,n,omit)
        if n.get('motion') and not n.get('_motion_applied'):
            from .motion import wrap
            return wrap(self,n,omit)
        if n.get('compose',{}).get('placeholder'):return f'Box {{ Text({quote(n["compose"]["placeholder"])}) }}'
        if n.get('compose',{}).get('conditional',{}).get('rule'):
            rule=n['compose']['conditional']['rule'];axis='maxWidth' if rule['axis']=='width' else 'maxHeight';branches=n['children'];left=self.emit(branches[0],omit) if branches else '';right=self.emit(branches[1],omit) if len(branches)>1 else ''
            return f'BoxWithConstraints {{ if ({axis} {rule["operator"]} {rule["value"]}.dp) {{ {left} }} else {{ {right} }} }}'
        aliases={'Avatar':'Card','Chip':'Button','Badge':'TextLabel','ListItem':'Row','TabRow':'Row'}
        if n['type'] in aliases:return self.emit({**n,'type':aliases[n['type']]},omit)
        if n['type']=='NavigationRail':
            if n['props'].get('orientation')=='horizontal':return self.emit({**n,'type':'Region'},omit)
            return f'NavigationRail(modifier = {self.modifier(n)}, containerColor = {self.color(n,"background")}) {{ '+ '\n'.join(self.nav_item(c,'NavigationRailItem') if c['type']=='NavigationItem' else self.emit(c) for c in n['children'])+' }'
        if n['type']=='RadioButton':return f'RadioButton(selected = v_{n["id"]}, onClick = {{ v_{n["id"]} = !v_{n["id"]} }}, enabled = {str(n["props"]["enabled"]).lower()}, modifier = {self.modifier(n)})'
        if n['type']=='ProgressIndicator':return f'LinearProgressIndicator(progress = {{ {float(n["props"]["value"])}f }}, modifier = {self.modifier(n)}, color = Color(0xFF{n["props"]["color"][1:]}))'
        if n['type'] in {'Shape','DrawingCanvas','Chart'}:
            from .graphics import native_graphic
            view=native_graphic(self,n)
            return f'androidx.compose.ui.viewinterop.AndroidView(factory = {{ {view}(it) }}, modifier = {self.modifier(n)})'
        if n['type']=='ConstraintLayout':
            from .constraints import compose_container
            return compose_container(self,n,omit)
        if n['type']=='Region':return self.emit({**n,'type':'Row' if n['props'].get('orientation')=='horizontal' else 'Column'},omit)
        if n['type'] in {'Guideline','Barrier'}:return ''
        if n['type']=='Surface':
            return self.emit({**n,'type':'Card','props':{**n['props'],'variant':'filled','elevation':0}},omit)
        if n['type']=='ScrollContainer':return self.emit({**n,'type':'Column'},omit)
        if n['type']=='IconButton':return self.emit({**n,'type':'Button'},omit)
        kind=n['type'];p=n['props'];m=self.modifier({**n,'layout':{**n['layout'],'padding':0}}) if kind in {'Card','Button'} else self.modifier(n);var='v_'+n['id']
        children=lambda nodes=None:'\n'.join(self.emit(c,omit) for c in (n['children'] if nodes is None else nodes))
        if kind in {'ListView','RecyclerView','GridView','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'}:
            from .lists import compose_list
            return compose_list(self,n,omit)
        if kind=='Divider':return f'HorizontalDivider(modifier = {m})'
        if kind=='Grid':
            columns=n['layout']['columns'];rows=[]
            for i in range(0,len(n['children']),columns):
                cells=['Box(Modifier.weight(1f)) { '+self.emit(c,omit)+' }' for c in n['children'][i:i+columns]]
                cells+=['Spacer(Modifier.weight(1f))']*(columns-len(cells))
                rows.append(f"Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy({n['layout']['gap']}.dp)) {{ "+'\n'.join(cells)+' }')
            return f"Column({m}, verticalArrangement = Arrangement.spacedBy({n['layout']['gap']}.dp)) {{ "+'\n'.join(rows)+' }'
        if kind=='TextLabel':
            styles=n.get('compose',{}).get('styles',{});extra=''
            for key,unit in [('lineHeight','sp'),('letterSpacing','sp')]:
                value=styles.get(key,{}).get('value')
                if type(value) in (int,float):extra+=f', {key} = {value}.{unit}'
            weight=styles.get('fontWeight',{}).get('value');weight=weight.split('.')[-1] if isinstance(weight,str) and weight.startswith('FontWeight.') else 'Bold' if p['bold'] else 'Normal'
            for key,enum in [('fontStyle','androidx.compose.ui.text.font.FontStyle'),('textDecoration','androidx.compose.ui.text.style.TextDecoration')]:
                value=styles.get(key,{}).get('value')
                if isinstance(value,str) and value.startswith(key[0].upper()+key[1:]+'.'):extra+=f', {key} = {enum}.{value.split(".")[-1]}'
            family=styles.get('fontFamily',{}).get('value')
            if isinstance(family,dict) and isinstance(family.get('font'),str):
                import re,base64
                name=family['font'];source=self.doc.get('compose_project',{}).get('fonts',{}).get(name,'')
                if re.fullmatch(r'[a-z][a-z0-9_]*',name) and source.startswith(('data:font/ttf;base64,','data:font/otf;base64,')):
                    data=base64.b64decode(source.split(',',1)[1],validate=True);extension='otf' if source.startswith('data:font/otf') else 'ttf';self.files[f'app/src/main/res/font/{name}.{extension}']=data
                    extra+=f', fontFamily = androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(R.font.{name}))'
            if styles.get('softWrap',{}).get('value') is False:extra+=', softWrap = false'
            return f'Text(text = {self.string(n,"text")}, color = {self.color(n,"color")}, fontSize = {p["fontSize"]}.sp, maxLines = {p["maxLines"] if p["maxLines"] else 2147483647}, overflow = TextOverflow.{"Ellipsis" if p["overflow"]=="ellipsis" else "Clip"}, fontWeight = FontWeight.{weight}, textAlign = TextAlign.{dict(start="Start",center="Center",end="End")[p["align"]]}{extra}, modifier = {m})'
        if kind=='Icon':
            if p['icon']=='none':return ''
            return f'Icon(painterResource(R.drawable.agata_{p["icon"]}), contentDescription = {self.string(n,"description")}, tint = {self.color(n,"color")}, modifier = {m}.size(24.dp))'
        if kind in {'Row','Column','Box'}:
            if kind=='Box' and n['layout']['mode']=='free':
                alignments={'start':'Start','end':'End','center':'CenterHorizontally','fill':'Start'};verticals={'top':'Top','bottom':'Bottom','center':'CenterVertically','fill':'Top'}
                output=[]
                for child in n['children']:
                    l=child['layout'];alignment={('start','top'):'TopStart',('center','top'):'TopCenter',('end','top'):'TopEnd',('start','center'):'CenterStart',('center','center'):'Center',('end','center'):'CenterEnd',('start','bottom'):'BottomStart',('center','bottom'):'BottomCenter',('end','bottom'):'BottomEnd'}.get((l['anchorX'],l['anchorY']),'TopStart')
                    x=-l['x'] if l['anchorX']=='end' else l['x'];y=-l['y'] if l['anchorY']=='bottom' else l['y']
                    wrapper=f'Box(Modifier.align(Alignment.{alignment}).offset({x}.dp, {y}.dp)'
                    if l['anchorX']=='fill':wrapper+='.fillMaxWidth()'
                    if l['anchorY']=='fill':wrapper+='.fillMaxHeight()'
                    output.append(wrapper+') { '+self.emit(child,omit)+' }')
                return f'Box(modifier = {m}) {{ '+ '\n'.join(output)+' }'
            if kind=='Box':args=f'contentAlignment = Alignment.{dict(start="TopStart",center="Center",end="BottomEnd")[n["layout"]["alignment"]]}'
            else:
                orientation='horizontal' if kind=='Row' else 'vertical';cross='vertical' if kind=='Row' else 'horizontal'
                align=({'start':'Top','center':'CenterVertically','end':'Bottom'} if kind=='Row' else {'start':'Start','center':'CenterHorizontally','end':'End'})[n['layout']['alignment']]
                arrange={'start':f'spacedBy({n["layout"]["gap"]}.dp)','center':'Center','end':('End' if kind=='Row' else 'Bottom'),'spaceBetween':'SpaceBetween'}[n['layout']['arrangement']]
                args=f'{orientation}Arrangement = Arrangement.{arrange}, {cross}Alignment = Alignment.{align}'
            if kind=='Row' and n['layout']['wrap']:
                return f'FlowRow(modifier = {m}, horizontalArrangement = Arrangement.spacedBy({n["layout"]["gap"]}.dp), verticalArrangement = Arrangement.spacedBy({n["layout"]["gap"]}.dp)) {{\n{children()}\n}}'
            return f'{kind}(modifier = {m}, {args}) {{\n{children()}\n}}'
        if kind in {'Button','FloatingButton','NavigationItem'}:
            if kind=='NavigationItem':
                # Shared semantic item works in drawer and bottom bar, with independent label/icon/events.
                fun='FilledTonalButton' if p['selected'] else 'TextButton'
            elif kind=='FloatingButton':fun='FloatingActionButton'
            else:fun={'filled':'Button','outlined':'OutlinedButton','text':'TextButton','tonal':'FilledTonalButton','elevated':'Button'}[p['variant']]
            enabled='' if kind=='FloatingButton' else f', enabled = {str(p["enabled"]).lower()}'
            extras=''
            if kind=='Button':
                color=self.color(n,'background')
                colors={'filled':f'buttonColors(containerColor = {color})','tonal':f'filledTonalButtonColors(containerColor = {color})','text':f'textButtonColors(contentColor = {color})','outlined':f'outlinedButtonColors(contentColor = {color})','elevated':f'buttonColors(containerColor = {color})'}[p['variant']]
                padding_extra='' if n.get('compose') else f', contentPadding = PaddingValues({n["layout"]["padding"]}.dp)'
                from .compose_fidelity import material_colors
                imported_colors=material_colors(n,'ButtonDefaults.'+{'outlined':'outlinedButtonColors','text':'textButtonColors','tonal':'filledTonalButtonColors'}.get(p['variant'],'buttonColors'))
                rendered_colors=imported_colors or 'ButtonDefaults.'+colors
                extras=f'{padding_extra}, shape = RoundedCornerShape({p["radius"]}.dp), colors = {rendered_colors}'
                if p['variant']=='outlined':extras+=f', border = BorderStroke(1.dp, {color})'

            content=('\nSpacer(Modifier.width('+str(n['layout']['gap'])+'.dp))\n').join(filter(None,(self.emit(c,omit) for c in n['children'])))
            return f'{fun}(onClick = {{ {self.action(n)} }}, modifier = {m}{enabled}{extras}) {{\n{content}\n}}'
        if kind=='Card':
            fun={'filled':'Card','outlined':'OutlinedCard','elevated':'ElevatedCard','text':'Card','tonal':'Card'}[p['variant']]
            from .compose_fidelity import material_colors
            card_colors=material_colors(n,'CardDefaults.cardColors') or f'CardDefaults.cardColors(containerColor = {self.color(n,"background")})'
            return f'{fun}(modifier = {m}, shape = RoundedCornerShape({p["radius"]}.dp), colors = {card_colors}, elevation = CardDefaults.cardElevation(defaultElevation = {p["elevation"]}.dp)) {{ Column(Modifier.padding({0 if n.get("compose") else n["layout"]["padding"]}.dp), verticalArrangement = Arrangement.spacedBy({n["layout"]["gap"]}.dp)) {{\n{children()}\n}} }}'
        if kind=='TopBar':
            title=[c for c in n['children'] if c['role'] in {'title','subtitle'}]
            navigation=[c for c in n['children'] if c['role']=='navigation']
            actions=[c for c in n['children'] if c not in title+navigation]
            return f'TopAppBar(modifier = {m}, colors = TopAppBarDefaults.topAppBarColors(containerColor = {self.color(n,"background")}), title = {{ Column {{ {children(title)} }} }}, navigationIcon = {{ {children(navigation)} }}, actions = {{ {children(actions)} }})'
        if kind=='BottomBar':return f'NavigationBar(modifier = {m}, containerColor = {self.color(n,"background")}) {{\n'+ '\n'.join(self.nav_item(c) for c in n['children'])+'\n}'
        if kind=='Sidebar':raise ValueError('Sidebar deve ser filha direta da Column principal da Screen.')
        if kind in {'TextField','SearchBar'}:
            leading=next((c for c in n['children'] if c['role']=='leading'),None)
            trailing=next((c for c in n['children'] if c['role']=='trailing'),None)
            slots=(f', leadingIcon = {{ {self.emit(leading)} }}' if leading else '')+(f', trailingIcon = {{ {self.emit(trailing)} }}' if trailing and kind!='SearchBar' and p.get('keyboard')!='password' else '')
            if kind=='SearchBar':slots+=f', trailingIcon = {{ IconButton(onClick = {{ {var} = "" }}) {{ Icon(painterResource(R.drawable.agata_close), contentDescription = "Limpar pesquisa") }} }}'
            from .compose_fidelity import material_colors
            colors=material_colors(n,'TextFieldDefaults.colors' if p.get('variant')=='filled' else 'OutlinedTextFieldDefaults.colors')
            if colors:slots+=', colors = '+colors
            radius=n.get('compose',{}).get('styles',{}).get('radius',{}).get('value')
            if type(radius) in (int,float):slots+=f', shape = RoundedCornerShape({radius}.dp)'
            keyboard={'text':'Text','email':'Email','number':'Number','password':'Password','phone':'Phone'}.get(p.get('keyboard'),'Text')
            fun='TextField' if p.get('variant')=='filled' else 'OutlinedTextField'
            extra=f', label = {{ Text({self.string(n,"label")}) }}, isError = {str(bool(p["error"])).lower()}, supportingText = {{ Text({self.string(n,"error" if p["error"] else "helper")}) }}' if kind=='TextField' else ''
            if p.get('keyboard')=='password':extra+=f', visualTransformation = if (visible_{n["id"]}) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(), trailingIcon = {{ TextButton(onClick = {{ visible_{n["id"]} = !visible_{n["id"]} }}) {{ Text(if (visible_{n["id"]}) "Ocultar" else "Mostrar") }} }}'
            return f'{fun}(value = {var}, onValueChange = {{ {var} = it }}, enabled = {str(p["enabled"]).lower()}, placeholder = {{ Text({self.string(n,"placeholder")}) }}, modifier = {m}, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.{keyboard}){extra}{slots})'
        if kind in {'Checkbox','Switch'}:return f'{kind}(checked = {var}, onCheckedChange = {{ {var} = it }}, enabled = {str(p["enabled"]).lower()}, modifier = {m})'
        if kind=='Slider':return f'Slider(value = {var}, onValueChange = {{ {var} = it }}, valueRange = {float(p["min"])}f..{float(p["max"])}f, enabled = {str(p["enabled"]).lower()}, modifier = {m})'
        if kind=='Spacer':return f'Spacer(modifier = {m})'
        if kind=='Image':
            import base64
            source=p['source']
            if not source.startswith('data:image/png;base64,'):raise ValueError('Image requer PNG local; selecione uma imagem no Inspector.')
            data=base64.b64decode(source.split(',',1)[1],validate=True)
            if not data.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('PNG inválido.')
            self.files[f'app/src/main/res/drawable/{n["id"]}.png']=data
            return f'Image(painterResource(R.drawable.{n["id"]}), contentDescription = {self.string(n,"description")}, modifier = {m})'
        raise ValueError('Componente sem exportador Compose: '+kind)

    def nav_item(self,n,kind="NavigationBarItem"):
        if n['type']!='NavigationItem':raise ValueError('BottomBar aceita somente NavigationItem.')
        label=[c for c in n['children'] if c['type']=='TextLabel'];icons=[c for c in n['children'] if c['type']=='Icon']
        return f'{kind}(selected = {str(n["props"]["selected"]).lower()}, enabled = {str(n["props"]["enabled"]).lower()}, onClick = {{ {self.action(n)} }}, label = {{ '+ '\n'.join(self.emit(c) for c in label)+' }, icon = { '+'\n'.join(self.emit(c) for c in icons)+' })'

    def generate(self):
        base='app/src/main/java/'+self.ns.replace('.','/')
        for s in self.doc['screens']:
            declarations=[]
            for n in walk(s['root']):
                if n['type'] in {'TextField','SearchBar','Checkbox','Switch','Slider','RadioButton'}:
                    value=n['props'].get('checked',n['props'].get('value',''))
                    literal=str(value).lower() if type(value) is bool else f'{float(value)}f' if type(value) in (int,float) else quote(value)
                    if n['props'].get('keyboard')=='password':declarations.append(f'var visible_{n["id"]} by rememberSaveable {{ mutableStateOf(false) }}')
                    declarations.append(f'var v_{n["id"]} by rememberSaveable {{ mutableStateOf({literal}) }}')
            drawers=[c for c in s['root']['children'] if c['type']=='Sidebar']
            if len(drawers)>1:raise ValueError('Use no máximo uma Sidebar por Screen.')
            content=self.emit(s['root'],[d['id'] for d in drawers])
            if any(n['layout']['responsive'] for n in walk(s['root'])):
                branches=[]
                for label,width in [('extraLarge',1800),('large',1400),('expanded',900),('medium',700),('compact',390)]:
                    for landscape in [True,False]:
                        height=300 if landscape else 1400
                        variant=resolve_screen(s,width,height)
                        condition=('maxWidth >= 1600.dp' if label=='extraLarge' else 'maxWidth >= 1200.dp' if label=='large' else 'maxWidth >= 840.dp' if label=='expanded' else 'maxWidth >= 600.dp' if label=='medium' else 'true')+(' && maxWidth > maxHeight' if landscape else '')
                        branches.append(condition+' -> { '+self.emit(variant['root'],[d['id'] for d in drawers])+' }')
                content='BoxWithConstraints(Modifier.fillMaxSize()) { when { '+ '\n'.join(branches)+' } }'

            if drawers:
                drawer=drawers[0];body='\n'.join(self.emit(c) for c in drawer['children'])
                content='val drawerState = rememberDrawerState(DrawerValue.Closed)\n'+f'ModalNavigationDrawer(drawerState = drawerState, drawerContent = {{ ModalDrawerSheet {{ {body} }} }}) {{ Column {{ val scope = rememberCoroutineScope(); TextButton(onClick = {{ scope.launch {{ drawerState.open() }} }}) {{ Text("Menu") }}; {content} }} }}'
            code=f'''package {self.ns}.ui.screens
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
{('import androidx.compose.animation.*'+chr(10)+'import androidx.compose.animation.core.*'+chr(10)+'import androidx.compose.ui.platform.LocalContext'+chr(10)) if any(n.get('motion') for n in walk(s['root'])) else ''}import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
{('import androidx.compose.foundation.lazy.*'+chr(10)+'import androidx.compose.foundation.lazy.grid.*'+chr(10)+'import androidx.compose.foundation.lazy.staggeredgrid.*'+chr(10)) if any(n['type'] in {'ListView','RecyclerView','GridView','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'} for n in walk(s['root'])) else ''}import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.constraintlayout.compose.*
import androidx.compose.ui.zIndex
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import {self.ns}.R

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun Screen_{s['id']}(onAction: (String, String) -> Unit) {{
{chr(10).join(declarations)}
{content}
}}
'''
            self.files[f'{base}/ui/screens/Screen_{s["id"]}.kt']=code
        handler='if (action == "back") navController.popBackStack() else if (action == "navigate" || action == "replace" || action.startsWith("popUpTo:")) navController.navigate(target) { launchSingleTop = true; if (action == "replace") popUpTo(navController.currentDestination?.route ?: target) { inclusive = true }; if (action.startsWith("popUpTo:")) popUpTo(action.substringAfter(":")) } else if (action == "url") context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(target))) else if (action == "custom") android.widget.Toast.makeText(context, "Ação: " + target, android.widget.Toast.LENGTH_SHORT).show()'
        navigation='\n'.join(f'composable({quote(s["id"])}) {{ Screen_{s["id"]}(onAction = {{ action, target -> '+handler+' }) }' for s in self.doc['screens'])
        self.files[f'{base}/navigation/AppNavigation.kt']=f'''package {self.ns}.navigation
import androidx.compose.runtime.Composable
import androidx.navigation.compose.*
import {self.ns}.ui.screens.*
@Composable fun AppNavigation() {{
 val context = androidx.compose.ui.platform.LocalContext.current
 val navController = rememberNavController()
 NavHost(navController, startDestination = {quote(self.doc['start_screen'])}) {{
 {navigation}
 }}
}}
'''
        self.files[f'{base}/MainActivity.kt']=f'''package {self.ns}
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import {self.ns}.navigation.AppNavigation
import {self.ns}.ui.theme.AgataTheme
class MainActivity : ComponentActivity() {{
 override fun onCreate(savedInstanceState: Bundle?) {{
  super.onCreate(savedInstanceState)
  enableEdgeToEdge()
  setContent {{ AgataTheme {{ Surface {{ Box(Modifier.fillMaxSize().safeDrawingPadding()) {{ AppNavigation() }} }} }} }}
 }}
}}
'''
        theme=self.doc['theme'];dark={'system':'isSystemInDarkTheme()','light':'false','dark':'true'}[theme['darkMode']]
        schemes=self.doc.get('compose_project',{}).get('themes',{})
        if self.doc.get('design_system'):
            from .premium import scheme
            schemes={'dark':scheme(self.doc),'light':scheme(self.doc)}
        from .compose_fidelity import scalar
        theme_call=lambda mode: mode+'ColorScheme('+', '.join(key+' = '+scalar(value) for key,value in schemes.get(mode,{}).items() if key!='constructor' and isinstance(value,str) and value.startswith('#') and key.isalpha())+')' if schemes.get(mode) else mode+'ColorScheme(primary = AgataPrimary)'
        self.files[f'{base}/ui/theme/Theme.kt']=f'''package {self.ns}.ui.theme
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
@Composable fun AgataTheme(content: @Composable () -> Unit) {{
 val dark = {dark}
 val colors = if ({str(theme['dynamicColor']).lower()} && Build.VERSION.SDK_INT >= 31) {{
  if (dark) dynamicDarkColorScheme(LocalContext.current) else dynamicLightColorScheme(LocalContext.current)
 }} else if (dark) {theme_call('dark')} else {theme_call('light')}
 MaterialTheme(colorScheme = colors, typography = AgataTypography, content = content)
}}
'''
        self.files[f'{base}/ui/theme/Color.kt']=f'package {self.ns}.ui.theme\nimport androidx.compose.ui.graphics.Color\nval AgataPrimary = Color(0xFF{theme["primary"][1:]})\n'
        self.files[f'{base}/ui/theme/Type.kt']=f'package {self.ns}.ui.theme\nimport androidx.compose.material3.Typography\nval AgataTypography = Typography()\n'
        for name,path in PATHS.items():self.files[f'app/src/main/res/drawable/agata_{name}.xml']=f'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:pathData="{path}" android:fillColor="@android:color/transparent" android:strokeColor="#242424" android:strokeWidth="2" android:strokeLineCap="round"/></vector>\n'
        self.files['app/src/main/res/values/strings.xml']='<resources>\n'+''.join(f'<string name="{k}">{resource_text(v)}</string>\n' for k,v in self.strings.items())+'</resources>\n'
        if self.doc.get('design_system'):
            from .premium import files as premium_files
            self.files.update(premium_files(self.doc))
        return self.files

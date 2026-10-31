"""Native Android XML + Kotlin Activity navigation; independent of Compose output."""
from xml.etree import ElementTree as ET
from apps.android_designer.domain.model import walk, resolve_screen
from apps.android_designer.exporters.compose import ComposeGenerator, PATHS, resource_text, quote

A='http://schemas.android.com/apk/res/android';APP='http://schemas.android.com/apk/res-auto'
ET.register_namespace('android',A);ET.register_namespace('app',APP)


class XmlGenerator(ComposeGenerator):
    def view(self,n,parent_type=None):
        aliases={'Avatar':'Card','Chip':'Button','Badge':'TextLabel','ListItem':'Row','NavigationRail':'Region','TabRow':'Row'}
        if n['type'] in aliases:return self.view({**n,'type':aliases[n['type']]},parent_type)
        graphic_tag=None
        if n['type'] in {'Shape','DrawingCanvas','Chart'}:
            from .graphics import native_graphic
            graphic_tag=native_graphic(self,n)
        if n['type'] in {'ListView','RecyclerView','GridView','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'}:
            from .lists import xml_list
            return xml_list(self,n)
        if n['type']=='ConstraintLayout':
            from .constraints import xml_container
            return xml_container(self,n)
        if n['type']=='Region':return self.view({**n,'type':'Row' if n['props'].get('orientation')=='horizontal' else 'Column'},parent_type)
        if n['type']=='Surface':return self.view({**n,'type':'Card','props':{**n['props'],'variant':'filled','elevation':0}},parent_type)
        if n['type']=='ScrollContainer':return self.view({**n,'type':'Column'},parent_type)
        if n['type']=='IconButton':return self.view({**n,'type':'Button'},parent_type)
        kind=n['type'];p=n['props'];layout=n['layout']
        tag={'Grid':'GridLayout','Divider':'View','Column':'LinearLayout','Row':'LinearLayout','Box':'FrameLayout','TopBar':'LinearLayout',
             'Sidebar':'LinearLayout','BottomBar':'LinearLayout','NavigationItem':'com.google.android.material.button.MaterialButton',
             'TextLabel':'TextView','Icon':'ImageView','Button':'com.google.android.material.button.MaterialButton',
             'FloatingButton':'com.google.android.material.floatingactionbutton.FloatingActionButton',
             'Card':'com.google.android.material.card.MaterialCardView','TextField':'com.google.android.material.textfield.TextInputLayout',
             'SearchBar':'SearchView','Image':'ImageView','RadioButton':'RadioButton','ProgressIndicator':'ProgressBar','Checkbox':'CheckBox','Switch':'Switch','Slider':'SeekBar','Spacer':'Space'}.get(kind,graphic_tag)
        def size(k):return {'fill':'match_parent','wrap':'wrap_content'}.get(str(layout[k]),f'{layout[k]}dp')
        v=ET.Element(tag,{f'{{{A}}}id':'@+id/'+n['id'],f'{{{A}}}layout_width':size('width'),f'{{{A}}}layout_height':size('height')})
        def attr(k,val):v.set('{'+A+'}'+k,str(val))
        def app(k,val):v.set('{'+APP+'}'+k,str(val))
        if n.get('_layer'):attr('translationZ',f"{n['_layer']['order']}dp");attr('alpha',n['_layer']['opacity'])
        if not layout['visible']:attr('visibility','gone')
        if kind=='Grid':attr('columnCount',layout['columns'])
        if kind=='Divider':attr('background','#CCCCCC')
        if layout['margin']:attr('layout_margin',f'{layout["margin"]}dp')
        if layout['minWidth']:attr('minWidth',f'{layout["minWidth"]}dp')
        if layout['minHeight']:attr('minHeight',f'{layout["minHeight"]}dp')
        if parent_type=='Grid':attr('layout_width','0dp');attr('layout_columnWeight',1)
        if layout['padding']:attr('padding',f'{layout["padding"]}dp')
        if parent_type=='BottomBar':attr('layout_width','0dp');attr('layout_weight',1)
        if layout['weight']:attr('layout_weight',layout['weight']);attr('layout_'+('width' if parent_type=='Row' else 'height'),'0dp')
        if 'enabled' in p:attr('enabled',str(p['enabled']).lower())
        if kind in {'Column','Row','TopBar','Sidebar','BottomBar'}:
            attr('orientation','horizontal' if kind in {'Row','TopBar','BottomBar'} else 'vertical')
            attr('gravity',{'start':'start','center':'center','end':'end'}[layout['alignment']])
        if kind=='TextLabel':
            if p['maxLines']:attr('maxLines',p['maxLines'])
            if p['overflow']=='ellipsis':attr('ellipsize','end')
            self.string(n,'text');attr('text','@string/'+n['id']+'_text');attr('textColor',p['color']);attr('textSize',f'{p["fontSize"]}sp');attr('textStyle','bold' if p['bold'] else 'normal');attr('gravity',p['align'])
        if kind=='Icon':
            if p['icon']!='none':attr('src','@drawable/agata_'+p['icon'])
            self.string(n,'description');attr('contentDescription','@string/'+n['id']+'_description');attr('tint',p['color'])
        if kind in {'Button','NavigationItem','FloatingButton'}:
            labels=[c for c in n['children'] if c['type']=='TextLabel'];icons=[c for c in n['children'] if c['type']=='Icon' and c['props']['icon']!='none']
            if any(c['events'] for c in n['children']):raise ValueError('XML: eventos individuais no conteúdo de um botão não são suportados. Configure o evento no Button.')
            if any(c['type'] not in {'TextLabel','Icon'} for c in n['children']):raise ValueError('Botões XML suportam somente texto e ícones.')
            if labels and kind!='FloatingButton':
                child=labels[0];self.string(child,'text');attr('text','@string/'+child['id']+'_text');attr('textColor',child['props']['color'])
            if icons:app('srcCompat' if kind=='FloatingButton' else 'icon','@drawable/agata_'+icons[0]['props']['icon'])
            if kind=='Button':
                app('iconPadding',f'{layout["gap"]}dp')
                app('cornerRadius',f'{p["radius"]}dp');app('backgroundTint',p['background'])
                if p['variant'] in {'outlined','text'}:app('backgroundTint','@android:color/transparent')
                if p['variant']=='outlined':app('strokeWidth','1dp');app('strokeColor',p['background'])
        elif kind=='TextField':
            self.string(n,'label');attr('hint','@string/'+n['id']+'_label');app('boxBackgroundMode','filled' if p['variant']=='filled' else 'outline')
            child=ET.SubElement(v,'com.google.android.material.textfield.TextInputEditText',{f'{{{A}}}id':'@+id/'+n['id']+'_input',f'{{{A}}}layout_width':'match_parent',f'{{{A}}}layout_height':'wrap_content'})
            for prop,xml_key in [('value','text'),('placeholder','hint')]:self.string(n,prop);child.set('{'+A+'}'+xml_key,'@string/'+n['id']+'_'+prop)
            child.set('{'+A+'}enabled',str(p['enabled']).lower())
            child.set('{'+A+'}inputType',{'text':'text','email':'textEmailAddress','number':'numberDecimal','password':'textPassword','phone':'phone'}[p['keyboard']])
            if p['helper']:self.string(n,'helper');app('helperText','@string/'+n['id']+'_helper')
            if p['error']:app('errorEnabled','true')
            if p['keyboard']=='password':app('endIconMode','password_toggle')
            for c in n['children']:
                icon=c['props'].get('icon','none')
                if icon!='none':app('startIconDrawable' if c['role']=='leading' else 'endIconDrawable','@drawable/agata_'+icon)
        elif kind=='SearchBar':
            self.string(n,'placeholder');attr('queryHint','@string/'+n['id']+'_placeholder');attr('iconifiedByDefault','false')
        elif kind=='Image':
            # Shared resource encoding only; no Compose code is used by this backend.
            self.emit(n);attr('src','@drawable/'+n['id']);self.string(n,'description');attr('contentDescription','@string/'+n['id']+'_description')
        elif kind in {'Checkbox','Switch','RadioButton'}:attr('checked',str(p['checked']).lower())
        elif kind=='ProgressIndicator':
            v.set('style','@android:style/Widget.ProgressBar.Horizontal');attr('max',100);attr('progress',round(p['value']*100));attr('indeterminate','false');attr('progressTint',p['color'])
        elif kind=='Slider':attr('max',100);attr('progress',round((p['value']-p['min'])/(p['max']-p['min'])*100))
        elif kind=='Card':
            app('cardCornerRadius',f'{p["radius"]}dp');app('cardElevation',f'{p["elevation"]}dp');app('cardBackgroundColor',p['background'])
            inner=ET.SubElement(v,'LinearLayout',{f'{{{A}}}orientation':'vertical',f'{{{A}}}layout_width':'match_parent',f'{{{A}}}layout_height':'wrap_content'})
            for i,c in enumerate(n['children']):
                child=self.view(c,kind)
                if i:child.set('{'+A+'}layout_marginTop',f"{layout['gap']}dp")
                inner.append(child)
        elif kind in {'Shape','DrawingCanvas','Chart'}:pass
        else:
            if p.get('background'):attr('background',p['background'])
            for i,c in enumerate(n['children']):
                child=self.view(c,kind)
                if i and kind in {'Column','Row','TopBar','Sidebar','BottomBar'}:child.set('{'+A+'}layout_marginStart' if kind in {'Row','TopBar','BottomBar'} else '{'+A+'}layout_marginTop',f"{layout['gap']}dp")
                if kind=='Box' and layout['mode']=='free':
                    l=c['layout']
                    if (l['anchorX']=='center' and l['x']) or (l['anchorY']=='center' and l['y']):raise ValueError('XML: centro com deslocamento livre não é suportado; use âncora start/top.')
                    gravity={'start':'start','end':'end','center':'center_horizontal','fill':'start'}[l['anchorX']]+'|'+{'top':'top','bottom':'bottom','center':'center_vertical','fill':'top'}[l['anchorY']]
                    child.set('{'+A+'}layout_gravity',gravity)
                    child.set('{'+A+'}layout_marginStart' if l['anchorX']!='end' else '{'+A+'}layout_marginEnd',f"{l['x']}dp")
                    child.set('{'+A+'}layout_marginTop' if l['anchorY']!='bottom' else '{'+A+'}layout_marginBottom',f"{l['y']}dp")
                    if l['anchorX']=='fill':child.set('{'+A+'}layout_width','match_parent')
                    if l['anchorY']=='fill':child.set('{'+A+'}layout_height','match_parent')
                v.append(child)
        if parent_type!='ConstraintLayout' and (layout['maxWidth']<4096 or layout['maxHeight']<4096 or layout['aspectRatio']):
            wrapper=ET.Element('androidx.constraintlayout.widget.ConstraintLayout',{f'{{{A}}}layout_width':size('width'),f'{{{A}}}layout_height':size('height')})
            for key in ['layout_weight','layout_columnWeight']:
                value=v.attrib.pop('{'+A+'}'+key,None)
                if value is not None:wrapper.set('{'+A+'}'+key,value)
            if layout['weight']:wrapper.set('{'+A+'}layout_'+('width' if parent_type=='Row' else 'height'),'0dp')
            if parent_type=='Grid':wrapper.set('{'+A+'}layout_width','0dp')
            for axis in ['Width','Height']:
                k=axis.lower();bounded=layout['max'+axis]<4096
                if bounded:
                    v.set('{'+A+'}layout_'+k,'0dp')
                    v.set('{'+APP+'}layout_constraint'+axis+'_min',f"{layout['min'+axis]}dp")
                    v.set('{'+APP+'}layout_constraint'+axis+'_max',f"{layout['max'+axis]}dp")
                else:v.set('{'+A+'}layout_'+k,size(k))
            for name in ['Start_toStartOf','End_toEndOf','Top_toTopOf','Bottom_toBottomOf']:v.set('{'+APP+'}layout_constraint'+name,'parent')
            v.set('{'+APP+'}layout_constraintHorizontal_bias','0');v.set('{'+APP+'}layout_constraintVertical_bias','0')
            if layout['aspectRatio']:
                v.set('{'+A+'}layout_height','0dp');v.set('{'+APP+'}layout_constraintDimensionRatio',str(layout['aspectRatio']))
            wrapper.append(v);v=wrapper
        if layout['scroll']!='none':
            wrapper=ET.Element('ScrollView' if layout['scroll']=='vertical' else 'HorizontalScrollView',{f'{{{A}}}layout_width':size('width'),f'{{{A}}}layout_height':size('height')})
            wrapper.append(v);return wrapper
        return v

    def generate(self):
        screens=self.doc['screens'];base='app/src/main/java/'+self.ns.replace('.','/')
        cases=[];binders=[];has_lists=any(n['type'] in {'ListView','RecyclerView','GridView','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'} for s in screens for n in walk(s['root']))
        for s in screens:
            self.qualifier='';view=self.view(s['root']);self.files[f'app/src/main/res/layout/{s["id"]}.xml']=ET.tostring(view,encoding='unicode')+'\n'
            if any(n['layout']['responsive'] for n in walk(s['root'])):
                for qualifier,width,height in [('w600dp',700,1400),('w840dp',900,1400),('land',390,300),('w600dp-land',700,300),('w840dp-land',900,300)]:
                    variant=resolve_screen(s,width,height);self.qualifier='-'+qualifier
                    self.files[f'app/src/main/res/layout-{qualifier}/{s["id"]}.xml']=ET.tostring(self.view(variant['root']),encoding='unicode')+'\n'
            self.qualifier=''
            bindings=[]
            for n in walk(s['root']):
                e=n['events'].get('onClick')
                if e:
                    action='goBack()' if e['action']=='back' else f'openScreen({quote(e["target"])}, true)'
                    if e['action']=='navigate' and e.get('policy')=='replace':action='if (history.isNotEmpty()) history.removeAt(history.lastIndex); '+action
                    if e['action']=='navigate' and e.get('policy')=='popUpTo':action=f'while (history.size > 1 && history.last() != {quote(e["popUpTo"])}) history.removeAt(history.lastIndex); '+action
                    if e['action']=='url':action=f'startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse({quote(e["target"])})))'
                    if e['action']=='custom':action=f'android.widget.Toast.makeText(this, {quote("Ação: "+e["target"])}, android.widget.Toast.LENGTH_SHORT).show()'
                    conditions=[]
                    for rule in e.get('validation',[]):
                        value=f'findViewById<android.widget.EditText>(R.id.{rule["field"]}_input).text.toString()'
                        conditions.append(value+'.isBlank()' if rule['type']=='required' else value+'.length < 6' if rule['type']=='password' else '!android.util.Patterns.EMAIL_ADDRESS.matcher('+value+').matches()')
                    if conditions:action='if ('+' || '.join(conditions)+') { android.widget.Toast.makeText(this, "Preencha os campos corretamente", android.widget.Toast.LENGTH_SHORT).show() } else { '+action+' }'
                    bindings.append(f'findViewById<android.view.View>(R.id.{n["id"]})?.setOnClickListener {{ {action} }}')
                if n['type']=='TextField' and n['props']['error']:
                    bindings.append(f'findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.{n["id"]})?.error = {quote(n["props"]["error"])}')
            from .lists import xml_bindings
            scoped='; '.join(bindings).replace('findViewById<','root.findViewById<')
            if has_lists:
                binders.append(f'private fun bind_{s["id"]}(root: android.view.View) {{ '+(scoped+'; ' if scoped else '')+xml_bindings(self,s['root'],'bind_'+s['id'])+' }')
                bindings=[f'bind_{s["id"]}(window.decorView)']
            cases.append(f'{quote(s["id"])} -> {{ setContentView(R.layout.{s["id"]}); '+ '; '.join(bindings)+' }')
        self.files[f'{base}/MainActivity.kt']=f'''package {self.ns}
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
class MainActivity : AppCompatActivity() {{
 {chr(10).join(binders)}
 {('private class AgataItemHolder(view: android.view.View) : androidx.recyclerview.widget.RecyclerView.ViewHolder(view)') if has_lists else ''}
 private val history = mutableListOf<String>()
 override fun onCreate(savedInstanceState: Bundle?) {{
  super.onCreate(savedInstanceState)
  history.addAll(savedInstanceState?.getStringArrayList("routes") ?: arrayListOf({quote(self.doc['start_screen'])}))
  openScreen(history.last(), false)
 }}
 private fun openScreen(route: String, push: Boolean) {{
  if (push) history.add(route)
  when(route) {{ {chr(10).join(cases)} }}
 }}
 private fun goBack() {{ if (history.size > 1) {{ history.removeAt(history.lastIndex); openScreen(history.last(), false) }} else finish() }}
 @Deprecated("Legacy Activity back dispatch") override fun onBackPressed() {{ goBack() }}
 override fun onSaveInstanceState(outState: Bundle) {{ outState.putStringArrayList("routes", ArrayList(history)); super.onSaveInstanceState(outState) }}
}}
'''
        self.files['app/src/main/res/values/themes.xml']='<resources><style name="Theme.Agata" parent="Theme.Material3.DayNight.NoActionBar"/></resources>\n'
        self.files['app/src/main/res/values/strings.xml']='<resources>'+''.join(f'<string name="{k}">{resource_text(v)}</string>' for k,v in self.strings.items())+'</resources>\n'
        for name,path in PATHS.items():self.files[f'app/src/main/res/drawable/agata_{name}.xml']=f'<vector xmlns:android="{A}" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:pathData="{path}" android:fillColor="@android:color/transparent" android:strokeColor="#242424" android:strokeWidth="2"/></vector>\n'
        return self.files

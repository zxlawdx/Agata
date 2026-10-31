"""Native Android XML + Kotlin Activity navigation; independent of Compose output."""
from xml.etree import ElementTree as ET
from apps.android_designer.domain.model import walk
from apps.android_designer.exporters.compose import ComposeGenerator, PATHS, resource_text, quote

A='http://schemas.android.com/apk/res/android';APP='http://schemas.android.com/apk/res-auto'
ET.register_namespace('android',A);ET.register_namespace('app',APP)


class XmlGenerator(ComposeGenerator):
    def view(self,n,parent_type=None):
        kind=n['type'];p=n['props'];layout=n['layout']
        tag={'Column':'LinearLayout','Row':'LinearLayout','Box':'FrameLayout','TopBar':'LinearLayout',
             'Sidebar':'LinearLayout','BottomBar':'LinearLayout','NavigationItem':'com.google.android.material.button.MaterialButton',
             'TextLabel':'TextView','Icon':'ImageView','Button':'com.google.android.material.button.MaterialButton',
             'FloatingButton':'com.google.android.material.floatingactionbutton.FloatingActionButton',
             'Card':'com.google.android.material.card.MaterialCardView','TextField':'com.google.android.material.textfield.TextInputLayout',
             'SearchBar':'SearchView','Image':'ImageView','Checkbox':'CheckBox','Switch':'Switch','Slider':'SeekBar','Spacer':'Space'}[kind]
        def size(k):return {'fill':'match_parent','wrap':'wrap_content'}.get(str(layout[k]),f'{layout[k]}dp')
        v=ET.Element(tag,{f'{{{A}}}id':'@+id/'+n['id'],f'{{{A}}}layout_width':size('width'),f'{{{A}}}layout_height':size('height')})
        def attr(k,val):v.set('{'+A+'}'+k,str(val))
        def app(k,val):v.set('{'+APP+'}'+k,str(val))
        if layout['padding']:attr('padding',f'{layout["padding"]}dp')
        if parent_type=='BottomBar':attr('layout_width','0dp');attr('layout_weight',1)
        if layout['weight']:attr('layout_weight',layout['weight']);attr('layout_'+('width' if parent_type=='Row' else 'height'),'0dp')
        if 'enabled' in p:attr('enabled',str(p['enabled']).lower())
        if kind in {'Column','Row','TopBar','Sidebar','BottomBar'}:
            attr('orientation','horizontal' if kind in {'Row','TopBar','BottomBar'} else 'vertical')
            attr('gravity',{'start':'start','center':'center','end':'end'}[layout['alignment']])
        if kind=='TextLabel':
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
            for c in n['children']:
                icon=c['props'].get('icon','none')
                if icon!='none':app('startIconDrawable' if c['role']=='leading' else 'endIconDrawable','@drawable/agata_'+icon)
        elif kind=='SearchBar':
            self.string(n,'placeholder');attr('queryHint','@string/'+n['id']+'_placeholder');attr('iconifiedByDefault','false')
        elif kind=='Image':
            # Shared resource encoding only; no Compose code is used by this backend.
            self.emit(n);attr('src','@drawable/'+n['id']);self.string(n,'description');attr('contentDescription','@string/'+n['id']+'_description')
        elif kind in {'Checkbox','Switch'}:attr('checked',str(p['checked']).lower())
        elif kind=='Slider':attr('max',100);attr('progress',round((p['value']-p['min'])/(p['max']-p['min'])*100))
        elif kind=='Card':
            app('cardCornerRadius',f'{p["radius"]}dp');app('cardElevation',f'{p["elevation"]}dp');app('cardBackgroundColor',p['background'])
            inner=ET.SubElement(v,'LinearLayout',{f'{{{A}}}orientation':'vertical',f'{{{A}}}layout_width':'match_parent',f'{{{A}}}layout_height':'wrap_content'})
            for c in n['children']:inner.append(self.view(c,kind))
        else:
            if p.get('background'):attr('background',p['background'])
            for c in n['children']:v.append(self.view(c,kind))
        if layout['scroll']!='none':
            wrapper=ET.Element('ScrollView' if layout['scroll']=='vertical' else 'HorizontalScrollView',{f'{{{A}}}layout_width':size('width'),f'{{{A}}}layout_height':size('height')})
            wrapper.append(v);return wrapper
        return v

    def generate(self):
        screens=self.doc['screens'];base='app/src/main/java/'+self.ns.replace('.','/')
        cases=[]
        for s in screens:
            view=self.view(s['root']);self.files[f'app/src/main/res/layout/{s["id"]}.xml']=ET.tostring(view,encoding='unicode')+'\n'
            bindings=[]
            for n in walk(s['root']):
                e=n['events'].get('onClick')
                if e:
                    action='goBack()' if e['action']=='back' else f'openScreen({quote(e["target"])}, true)'
                    bindings.append(f'findViewById<android.view.View>(R.id.{n["id"]})?.setOnClickListener {{ {action} }}')
                if n['type']=='TextField' and n['props']['error']:
                    bindings.append(f'findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.{n["id"]}).error = {quote(n["props"]["error"])}')
            cases.append(f'{quote(s["id"])} -> {{ setContentView(R.layout.{s["id"]}); '+ '; '.join(bindings)+' }')
        self.files[f'{base}/MainActivity.kt']=f'''package {self.ns}
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
class MainActivity : AppCompatActivity() {{
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

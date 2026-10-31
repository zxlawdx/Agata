"""Finite editable items, emitted using actual lazy scopes or native adapters.
The visual IR stores item subtrees; remote data sources remain source-only.
"""
from xml.etree import ElementTree as ET
from apps.android_designer.domain.model import walk
from .compose import quote
A='http://schemas.android.com/apk/res/android'
TYPES={'ListView','RecyclerView','GridView','LazyColumn','LazyRow','LazyVerticalGrid','LazyStaggeredGrid'}


def configuration(n):
    kind=n['type'];p=n['props'];horizontal=kind=='LazyRow' or kind=='RecyclerView' and p['orientation']=='horizontal'
    mode=p['layoutManager'] if kind=='RecyclerView' else 'staggered' if kind=='LazyStaggeredGrid' else 'grid' if kind in {'GridView','LazyVerticalGrid'} else 'linear'
    return horizontal,mode


def compose_list(generator,n,omit):
    horizontal,mode=configuration(n);l=n['layout'];gap=l['gap'];modifier=generator.modifier({**n,'layout':{**l,'padding':0,'scroll':'none'}})
    if mode=='staggered':
        function='LazyHorizontalStaggeredGrid' if horizontal else 'LazyVerticalStaggeredGrid';cells='rows' if horizontal else 'columns';args=f'{cells} = StaggeredGridCells.Fixed({l["columns"]}), horizontalArrangement = Arrangement.spacedBy({gap}.dp), verticalItemSpacing = {gap}.dp'
    elif mode=='grid':
        function='LazyHorizontalGrid' if horizontal else 'LazyVerticalGrid';cells='rows' if horizontal else 'columns';args=f'{cells} = GridCells.Fixed({l["columns"]}), horizontalArrangement = Arrangement.spacedBy({gap}.dp), verticalArrangement = Arrangement.spacedBy({gap}.dp)'
    else:
        function='LazyRow' if horizontal else 'LazyColumn';args=f'{"horizontal" if horizontal else "vertical"}Arrangement = Arrangement.spacedBy({gap}.dp)'
    items='\n'.join('item(key = '+quote(c['id'])+') { '+generator.emit(c,omit)+' }' for c in n['children'])
    return f'{function}(modifier = {modifier}, contentPadding = PaddingValues({l["padding"]}.dp), {args}) {{ {items} }}'


def xml_list(generator,n):
    kind=n['type'];l=n['layout'];tag='ListView' if kind=='ListView' else 'GridView' if kind=='GridView' else 'androidx.recyclerview.widget.RecyclerView'
    size=lambda k:{'fill':'match_parent','wrap':'wrap_content'}.get(str(l[k]),f'{l[k]}dp')
    v=ET.Element(tag,{f'{{{A}}}id':'@+id/'+n['id'],f'{{{A}}}layout_width':size('width'),f'{{{A}}}layout_height':size('height'),f'{{{A}}}padding':f'{l["padding"]}dp',f'{{{A}}}clipToPadding':'false'})
    if not l['visible']:v.set(f'{{{A}}}visibility','gone')
    if l['margin']:v.set(f'{{{A}}}layout_margin',f'{l["margin"]}dp')
    if kind=='ListView':v.set(f'{{{A}}}divider','@android:color/transparent');v.set(f'{{{A}}}dividerHeight',f'{l["gap"]}dp')
    if kind=='GridView':v.set(f'{{{A}}}numColumns',str(l['columns']));v.set(f'{{{A}}}horizontalSpacing',f'{l["gap"]}dp');v.set(f'{{{A}}}verticalSpacing',f'{l["gap"]}dp')
    for c in n['children']:
        item=generator.view(c)
        generator.files[f'app/src/main/res/layout{getattr(generator,"qualifier","")}/agata_item_{c["id"]}.xml']=ET.tostring(item,encoding='unicode')+'\n'
    return v


def xml_bindings(generator,root,binder):
    code=[]
    for n in walk(root):
        if n['type'] not in TYPES:continue
        layouts=', '.join('R.layout.agata_item_'+c['id'] for c in n['children']);items='intArrayOf('+layouts+')';horizontal,mode=configuration(n);cols=n['layout']['columns']
        if n['type'] in {'ListView','GridView'}:
            code.append(f'''root.findViewById<android.widget.{n['type']}>(R.id.{n['id']})?.let {{ list ->
 val layouts = {items}
 list.adapter = object : android.widget.BaseAdapter() {{
 override fun getCount() = layouts.size
 override fun getItem(position: Int): Any = position
 override fun getItemId(position: Int): Long = position.toLong()
 override fun getViewTypeCount() = layouts.size.coerceAtLeast(1)
 override fun getItemViewType(position: Int) = position
 override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup): android.view.View {{
  val view = convertView ?: layoutInflater.inflate(layouts[position], parent, false)
  {binder}(view); return view
 }}
 }}
}}''')
        else:
            orientation='androidx.recyclerview.widget.RecyclerView.HORIZONTAL' if horizontal else 'androidx.recyclerview.widget.RecyclerView.VERTICAL'
            manager=f'androidx.recyclerview.widget.LinearLayoutManager(this, {orientation}, false)' if mode=='linear' else f'androidx.recyclerview.widget.GridLayoutManager(this, {cols}, {orientation}, false)' if mode=='grid' else f'androidx.recyclerview.widget.StaggeredGridLayoutManager({cols}, {orientation})'
            code.append(f'''root.findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.{n['id']})?.let {{ list ->
 val layouts = {items}; list.layoutManager = {manager}
 list.adapter = object : androidx.recyclerview.widget.RecyclerView.Adapter<AgataItemHolder>() {{
 override fun getItemCount() = layouts.size
 override fun getItemViewType(position: Int) = position
 override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int) = AgataItemHolder(layoutInflater.inflate(layouts[viewType], parent, false))
 override fun onBindViewHolder(holder: AgataItemHolder, position: Int) {{ {binder}(holder.itemView) }}
 }}
}}''')
    return '\n'.join(code)

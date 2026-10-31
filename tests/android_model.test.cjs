const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const context={window:{},crypto};vm.runInNewContext(fs.readFileSync('apps/android_designer/static/js/model.js','utf8'),context);
const M=context.window.AgataUIModel,registry=JSON.parse(fs.readFileSync('apps/android_designer/static/model/components.json'));
const fixture=()=>new M.Document(JSON.parse(fs.readFileSync('examples/android/login-dashboard.json')),registry);
test('duplicate Screen regenerates node IDs and remaps self navigation',()=>{
 const m=fixture(),original=m.value.screens[0];original.root.events.onClick={action:'navigate',target:original.id};
 const copy=m.duplicateScreen(original);const ids=new Set();for(const s of m.value.screens)M.walk(s.root,n=>{assert.equal(ids.has(n.id),false);ids.add(n.id)});
 assert.equal(copy.root.events.onClick.target,copy.id);assert.notEqual(copy.id,original.id);
});
test('deleting destination removes orphan connections and history restores them',()=>{
 const m=fixture(),target=m.value.screens[1];m.deleteScreen(target);assert.equal(m.value.screens.length,1);
 M.walk(m.value.screens[0].root,n=>assert.notEqual(n.events.onClick?.target,target.id));m.undo();assert.equal(m.value.screens.length,2);m.redo();assert.equal(m.value.screens.length,1);
});
test('clone for cross-screen paste does not share children',()=>{
 const m=fixture(),original=m.value.screens[0].root.children[1],copy=m.cloneNode(original);copy.children[0].props.text='different';
 assert.notEqual(copy.children[0].id,original.children[0].id);assert.notEqual(original.children[0].props.text,'different');
});
test('registered compound components have independent semantic children',()=>{
 for(const kind of ['TopBar','Sidebar','BottomBar','Card','Button','TextField','SearchBar']){
  const node=M.node(registry,kind);assert.ok(node.children.length);assert.ok(node.children.every(c=>c.id&&c.props&&c.layout));
 }
});

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
 M.walk(m.value.screens[0].root,n=>{if(n.events.onClick?.target===target.id)assert.equal(n.events.onClick.broken,true);});m.undo();assert.equal(m.value.screens.length,2);m.redo();assert.equal(m.value.screens.length,1);
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
test('move is atomic, preserves IDs/events and one undo restores the original tree',()=>{
 const m=fixture(),first=m.value.screens[0],button=first.root.children.find(n=>n.type==='Button'),card=first.root.children.find(n=>n.type==='Card');const before=JSON.stringify(m.value);
 m.moveNodes([button.id],card.id,1);assert.equal(m.find(button.id).parent.id,card.id);assert.ok(m.find(button.id).node.events.onClick);assert.equal(m.past.length,1);m.undo();assert.equal(JSON.stringify(m.value),before);m.redo();assert.equal(m.find(button.id).parent.id,card.id);
});
test('cycles, locked ancestors, root moves and incompatible slots are rejected without mutation',()=>{
 const m=fixture(),root=m.value.screens[0].root,card=root.children.find(n=>n.type==='Card'),button=root.children.find(n=>n.type==='Button');
 for(const action of [()=>m.moveNodes([root.id],card.id),()=>m.moveNodes([card.id],card.children[0].id),()=>m.moveNodes([card.id],button.id)]){const before=JSON.stringify(m.value);assert.throws(action);assert.equal(JSON.stringify(m.value),before);}
 card.layout.locked=true;const before=JSON.stringify(m.value);assert.throws(()=>m.moveNodes([card.children[0].id],root.id));assert.equal(JSON.stringify(m.value),before);
});
test('palette insert, reordering, free positions and resize are semantic commands',()=>{
 const m=fixture(),root=m.value.screens[0].root,box=M.node(registry,'Box');box.layout.mode='free';m.insertNode(root.id,box);const text=M.node(registry,'TextLabel');m.insertNode(root.id,text,0);
 m.moveNodes([text.id],box.id,0,{x:32,y:48});assert.equal(m.find(text.id).node.layout.x,32);m.resizeNode(text.id,160,80);assert.equal(m.find(text.id).node.layout.width,160);assert.throws(()=>m.resizeNode(text.id,-1,80));
});
test('multi-selection drops ancestors only and retains document order',()=>{
 const m=fixture(),root=m.value.screens[0].root,card=root.children.find(n=>n.type==='Card'),target=m.value.screens[1].root;
 m.moveNodes([card.children[0].id,card.id],target.id);assert.equal(m.find(card.children[0].id).parent.id,card.id);
 const ids=[];for(const s of m.value.screens)M.walk(s.root,n=>ids.push(n.id));assert.equal(new Set(ids).size,ids.length);
});
test('group and cross-Screen moves preserve subtree properties',()=>{
 const m=fixture(),root=m.value.screens[0].root,items=root.children.slice(0,2),group=m.groupNodes(items.map(n=>n.id),'Column');assert.equal(group.children.length,2);m.moveNodes([group.id],m.value.screens[1].root.id);assert.equal(m.find(items[0].id).parent.id,group.id);
});
test('failed transactions roll back edits and do not enter history',()=>{
 const m=fixture(),before=JSON.stringify(m.value);assert.throws(()=>m.transact(d=>{d.app_name='changed';throw Error('abort')}));assert.equal(JSON.stringify(m.value),before);assert.equal(m.past.length,0);
});
test('ungroup and multi-paste are each one reversible transaction',()=>{
 const m=fixture(),root=m.value.screens[0].root,group=m.groupNodes(root.children.slice(0,2).map(n=>n.id));m.past=[];const before=JSON.stringify(m.value);m.ungroupNode(group.id);assert.equal(m.past.length,1);m.undo();assert.equal(JSON.stringify(m.value),before);
 m.past=[];m.insertNodes(root.id,[M.node(registry,'TextLabel'),M.node(registry,'Card')]);assert.equal(m.past.length,1);
});

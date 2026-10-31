const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('success expires, replacement cancels timer, errors persist, dispose cleans up',()=>{
 let next=0;const timers=new Map();const element=()=>({dataset:{},hidden:false,children:[],setAttribute(){},replaceChildren(...children){this.children=children}}),host=element();
 const ctx={window:{},document:{createElement:element},setTimeout:(fn,ms)=>{assert.equal(ms,4000);timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync('apps/home/static/js/notifications.js','utf8'),ctx);
 const toast=ctx.window.AgataNotifications.create(host);toast.show('one');assert.equal(timers.size,1);toast.show('two');assert.equal(timers.size,1);assert.equal(host.children[0].textContent,'two');
 [...timers.values()][0]();assert.equal(host.hidden,true);assert.equal(timers.size,0);
 toast.show('error',{error:true});assert.equal(host.hidden,false);assert.equal(timers.size,0);host.children[2].onclick();assert.equal(host.hidden,true);
 toast.show('another');toast.dispose();assert.equal(timers.size,0);assert.equal(host.hidden,true);
});

// Optional developer check. Runtime assets are committed and never regenerated here.
const fs=require('node:fs'),crypto=require('node:crypto');
const path='apps/sketch_editor/static/vendor/fabric.js';
const hash=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
if(hash!=='48f8f0915beb512fc7fe1b48c0eeb075dd0803c790efdfd75cd007f9c3eea2ca')throw Error('Fabric distribution is missing or modified');
console.log('Fabric 5.3.0 offline asset verified.');

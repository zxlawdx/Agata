const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory()){if(item.name!=='vendor')walk(file);}else if(file.endsWith('.js'))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});}}
walk('apps');console.log('Application JavaScript syntax passed.');

const {spawn}=require('node:child_process');
const server=spawn(process.env.PYTHON || 'python',['tests/ui_server.py'],{stdio:['ignore','pipe','inherit']});
let started=false,buffer='';const timer=setTimeout(()=>{server.kill();process.exit(1)},60000);
server.stdout.on('data',data=>{
 buffer+=data;const match=buffer.match(/http:\/\/127\.0\.0\.1:\d+\/fixture/);
 if(!started&&match){started=true;clearTimeout(timer);
  const test=spawn(process.execPath,[process.env.AGATA_UI_SCRIPT||process.argv[2]||'tests/ui_smoke.cjs'],{stdio:'inherit',env:{...process.env,AGATA_TEST_URL:match[0]}});
  test.on('exit',code=>{server.kill();process.exit(code??1)});
 }
});
server.on('exit',()=>{if(!started){clearTimeout(timer);console.error(buffer);process.exit(1)}});

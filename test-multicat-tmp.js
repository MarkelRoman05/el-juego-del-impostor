const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://127.0.0.1:3123';
function mk(name){return io(URL,{transports:['websocket']});}
function once(sock,ev){return new Promise(r=>sock.once(ev,r));}
function emitAck(sock,ev,data){return new Promise(r=>sock.emit(ev,data,res=>r(res)));}
(async()=>{
  const host=mk('h'); await once(host,'connect');
  const code=(await emitAck(host,'room:create',{name:'H'})).code;
  const p1=mk('p1'); await once(p1,'connect'); await emitAck(p1,'room:join',{code,name:'P1'});
  await emitAck(host,'config:set',{category:'animales,cine'});
  const started=Promise.all([once(host,'round:started'),once(p1,'round:started')]);
  await emitAck(host,'round:start');
  const [hr,pr]=await started;
  console.log('host cat:',JSON.stringify(hr.category));
  console.log('p1 cat:',JSON.stringify(pr.category));
  console.log('p1 word:',JSON.stringify(pr.word));
  const ok = hr.category && !hr.category.includes(' + ') && hr.category.length>0;
  console.log(ok?'PASS: chip muestra solo la categoria de la palabra':'FAIL: categoria multiple');
  host.close();p1.close();
  process.exit(ok?0:1);
})();

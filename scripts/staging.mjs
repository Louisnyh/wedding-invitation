import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,relative,sep,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build,root,shippedFiles } from './build.mjs';
import { createHarness } from '../tests/harness.mjs';
import { TOKEN_A } from '../tests/fixtures.mjs';
// Frontend v2 preview uses an isolated in-memory RSVP API and never calls production.
async function startOpeningPreview(port) {
  const dist = await build({frontend:'v2',staging:true,previewToken:TOKEN_A});
  let harness = createHarness();
  let scenario = 'ready';
  function setScenario(value) {
    if (!['ready','reset','legacy_attending','temporary_error','invalid','write_error','lost_ack'].includes(value)) throw new Error('Unknown scenario');
    if (value === 'reset') { harness = createHarness(); scenario = 'ready'; return; }
    scenario = value;
    harness.control.failRead = false; harness.control.failWrite = false; harness.control.loseWriteResponse = false;
    harness.setCell('Guests',1,'invitation_status','active');
    if (value === 'legacy_attending') harness.data.RSVP.push(['legacy-preview','c'.repeat(32),1,'2026-10-01T00:00:00Z','synthetic-a','confirmed',2,'','','']);
    if (value === 'temporary_error') harness.control.failRead = true;
    if (value === 'invalid') harness.setCell('Guests',1,'invitation_status','revoked');
    if (value === 'write_error') harness.control.failWrite = true;
    if (value === 'lost_ack') harness.control.loseWriteResponse = true;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    const host = req.headers.host;
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`)) {
      res.writeHead(403); res.end(); return;
    }
    try {
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'POST' && ['/api','/_preview/scenario'].includes(url.pathname)) {
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){res.writeHead(413);res.end();return;}}
        let input;try{input=JSON.parse(raw);}catch{res.writeHead(400);res.end();return;}
        if (url.pathname === '/_preview/scenario') {
          setScenario(input.scenario);res.writeHead(204);res.end();return;
        }
        const body=JSON.stringify(harness.post(input));res.writeHead(200,{'Content-Type':'application/json'});res.end(body);return;
      }
      if (req.method === 'GET' && url.pathname === '/_preview/stats') {
        const body=JSON.stringify({scenario,writes:harness.stats.writes.length,requests:harness.stats.requests.length});
        res.writeHead(200,{'Content-Type':'application/json'});res.end(body);return;
      }
      if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
      if (url.pathname === '/' || url.pathname === '/frontend-v2') {
        res.writeHead(302, {Location:'/frontend-v2/'}); res.end(); return;
      }
      const file = url.pathname === '/frontend-v2/' ? 'frontend-v2/index.html' : decodeURIComponent(url.pathname.slice(1));
      const target = resolve(dist, file);
      const targetFromDist = relative(dist, target);
      if (targetFromDist === '..' || targetFromDist.startsWith(`..${sep}`)) {res.writeHead(404); res.end(); return;}
      const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg'}[extname(file)];
      const body = await readFile(target);
      res.writeHead(200, {'Content-Type':mime}); res.end(req.method === 'HEAD' ? undefined : body);
    } catch {res.writeHead(404); res.end();}
  });
  await new Promise((resolve,reject) => {server.once('error',reject); server.listen(port,'127.0.0.1',resolve);});
  return {server, get harness(){return harness;}, setScenario, url:`http://127.0.0.1:${server.address().port}`};
}
export async function startStaging({port,frontend='legacy'}={}) {
  if (!['legacy','v2'].includes(frontend)) throw new Error('Unknown frontend');
  if (frontend === 'v2') return startOpeningPreview(port ?? 4174);
  port ??= 4173;
  const dist=await build({staging:true});
  const harness=createHarness();let scenario='locked';
  const scenarios=['locked','available','pending','force_closed','temporary_error','invalid','write_error','lost_ack','hostile_text'];
  function setScenario(value) {
    if(!scenarios.includes(value))throw new Error('Unknown scenario');
    scenario=value;harness.control.failRead=false;harness.control.failWrite=false;harness.control.loseWriteResponse=false;
    harness.control.now='2026-11-27T15:59:59Z';harness.setSetting('table_check_mode','scheduled');
    harness.setCell('Guests',1,'invitation_status','active');harness.setCell('Guests',1,'table_id','SECRET_TABLE_A');harness.setCell('Guests',1,'guest_name','测试宾客 A');
    if(value==='available'||value==='pending')harness.control.now='2026-11-27T16:00:00Z';
    if(value==='pending')harness.setCell('Guests',1,'table_id','');
    if(value==='force_closed')harness.setSetting('table_check_mode','force_closed');
    if(value==='temporary_error')harness.control.failRead=true;
    if(value==='invalid')harness.setCell('Guests',1,'invitation_status','revoked');
    if(value==='write_error')harness.control.failWrite=true;
    if(value==='lost_ack')harness.control.loseWriteResponse=true;
    if(value==='hostile_text')harness.setCell('Guests',1,'guest_name','<img src=x onerror=alert(1)>');
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    // Local tests cannot connect to any remote guest API, even if a regression reintroduces one.
    res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    const host=req.headers.host;
    if(!host||!/^127\.0\.0\.1:\d+$/.test(host)){res.writeHead(403);res.end();return;}
    if(req.headers.origin&&req.headers.origin!==`http://${host}`){res.writeHead(403);res.end();return;}
    const url=new URL(req.url,`http://${host}`);
    const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type});res.end(typeof body==='string'?body:JSON.stringify(body));};
    try {
      if(req.method==='POST'&&(url.pathname==='/api'||url.pathname==='/_staging/scenario')){
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){send(413,{});return;}}
        if(url.pathname==='/_staging/scenario'){
          setScenario(new URLSearchParams(raw).get('scenario'));res.writeHead(303,{Location:'/_staging'});res.end();return;
        }
        let input;try{input=JSON.parse(raw);}catch{send(400,{});return;}
        send(200,harness.post(input));return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){send(405,{});return;}
      if(url.pathname==='/_staging/stats'){send(200,{scenario,reads:harness.stats.requests.filter(action=>action==='invitation').length,writes:harness.stats.writes.length});return;}
      if(url.pathname==='/_staging'){
        send(200,`<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic staging controls</title><h1>Synthetic staging only</h1><p>No Google connection. Writes exist only in memory until this process stops.</p><form method="post" action="/_staging/scenario"><label>Scenario <select name="scenario">${scenarios.map(value=>`<option ${value===scenario?'selected':''}>${value}</option>`).join('')}</select></label><button>Apply scenario</button></form><p><a href="/?token=${TOKEN_A}">Open synthetic invitation</a></p><p><a href="/_staging/stats">View synthetic request counts</a></p></html>`,'text/html; charset=utf-8');return;
      }
      const file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
      if(!shippedFiles.includes(file)){send(404,{});return;}
      const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png'}[extname(file)];
      const body=await readFile(resolve(dist,file));res.writeHead(200,{'Content-Type':mime});res.end(req.method==='HEAD'?undefined:body);
    }catch{send(500,{schemaVersion:2,state:'temporary_error'});}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {server,harness,setScenario,url:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const frontend=process.argv.includes('--v2')?'v2':'legacy';
  const result=await startStaging({frontend});console.log(`${frontend==='v2'?'Frontend v2 preview':'Synthetic staging'}: ${result.url}/${frontend==='v2'?'frontend-v2/':'_staging'}`);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build,root,shippedFiles,openingFiles} from '../scripts/build.mjs';
import {startStaging} from '../scripts/staging.mjs';
import {TOKEN_A} from './fixtures.mjs';
test('build ships only approved static files, unchanged later photos, no legacy endpoints or synthetic fixtures',async()=>{
 const dist=await build();const files=(await readdir(dist,{recursive:true,withFileTypes:true})).filter(item=>item.isFile()).map(item=>(item.parentPath+'/'+item.name).slice(dist.length+1));assert.deepEqual(files.sort(),[...shippedFiles].sort());
 for(const file of ['assets/photos/story-01.webp','assets/photos/personal-note.webp']){
  const original=execFileSync('git',['show',`HEAD:${file}`],{cwd:root,maxBuffer:2e6});assert.deepEqual(await readFile(`${dist}/${file}`),original);
 }
 for(const file of ['style.css','assets/photos/hero-main.webp']) assert.deepEqual(await readFile(`${dist}/${file}`),await readFile(`${root}/${file}`));
 for(const file of shippedFiles.filter(file=>/\.(js|html)$/.test(file))){const code=await readFile(`${dist}/${file}`,'utf8');assert.ok(!code.includes(TOKEN_A));assert.ok(!/sampleData|AKfycbzO4|confirmedGroupMembers|console\.(log|error|warn)|createTableVisibility/.test(code));}
 const html=await readFile(`${dist}/index.html`,'utf8');assert.ok(html.includes('type="module" src="script.js"'));assert.ok(!/memory-form|member-list|dining-scene/.test(html));
});
test('remote build requires an explicitly valid endpoint and rejects query credentials',async()=>{
 await assert.rejects(build({apiUrl:'https://evil.invalid/'}));await assert.rejects(build({apiUrl:'https://script.google.com/macros/s/example/exec?token=secret'}));
});
test('localhost staging serves actual v2 backend, blocks private files and only mutates memory',async()=>{
 const result=await startStaging({port:0});
 try{
  const send=body=>fetch(result.url+'/api',{method:'POST',body:JSON.stringify(body)}).then(r=>r.json());
  const r=await send({action:'invitation',token:TOKEN_A});assert.equal(r.state,'ready');
  result.setScenario('available');assert.equal((await send({action:'invitation',token:TOKEN_A})).tableCheck.state,'available');
  for(const path of ['apps-script.gs','tests/fixtures.mjs','.git/config','README.md','assets/photos/story-01.JPG'])assert.equal((await fetch(result.url+'/'+path)).status,404);
  const post=await send({action:'rsvp',token:TOKEN_A,requestId:'e'.repeat(32),status:'unable',partySize:null,dietaryRequirements:'',privateNote:'synthetic only'});assert.equal(post.state,'saved');assert.equal(result.harness.stats.writes.length,1);
  assert.equal((await fetch(result.url+'/api',{method:'POST',headers:{Origin:'https://evil.invalid'},body:'{}'})).status,403);
 }finally{await new Promise(resolve=>result.server.close(resolve));}
});

test('frontend v2 builds an exact independent allowlist without touching the legacy output',async()=>{
 const oldFiles=await Promise.all(shippedFiles.map(async file=>[file,await readFile(`${root}/dist/${file}`)]));
 const dist=await build({frontend:'v2'});
 const files=(await readdir(dist,{recursive:true,withFileTypes:true})).filter(item=>item.isFile()).map(item=>(item.parentPath+'/'+item.name).slice(dist.length+1));
 assert.deepEqual(files.sort(),[...openingFiles].sort());
 for(const file of openingFiles) assert.deepEqual(await readFile(`${dist}/${file}`),await readFile(`${root}/${file}`));
 for(const [file,bytes] of oldFiles) assert.deepEqual(await readFile(`${root}/dist/${file}`),bytes);
 const html=await readFile(`${dist}/frontend-v2/index.html`,'utf8');
 assert.ok(html.includes('../assets/photos/hero-main.webp'));
 assert.ok(html.includes('../assets/photos/love-story-8433a-20.jpg'));
 assert.ok(html.includes('styles/page-02.css'));
 assert.ok(html.indexOf('story__content') < html.indexOf('story__figure'));
 assert.ok(!/rsvp|table-check|js\/api|src="script.js"|href="style.css"/.test(html));
 await assert.rejects(build({frontend:'v2',apiUrl:'https://script.google.com/macros/s/example/exec'}));
 await assert.rejects(build({frontend:'unknown'}));
});
test('frontend v2 serves only public invitation assets with no API or writable routes',async()=>{
 const result=await startStaging({frontend:'v2',port:0});
 try {
  const response=await fetch(result.url+'/');assert.equal(response.status,200);assert.equal(new URL(response.url).pathname,'/frontend-v2/');
  assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
  const html=await response.text();assert.ok(html.includes('Louis Ng'));
  const localAssets=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match=>match[1]).filter(value=>!value.startsWith('https://'));
  for(const asset of localAssets) assert.equal((await fetch(new URL(asset,response.url))).status,200,asset);
  const githubPagesBase=new URL('https://example.invalid/wedding-invitation/frontend-v2/');
  assert.equal(new URL('styles/page-02.css',githubPagesBase).pathname,'/wedding-invitation/frontend-v2/styles/page-02.css');
  assert.equal(new URL('../assets/photos/love-story-8433a-20.jpg',githubPagesBase).pathname,'/wedding-invitation/assets/photos/love-story-8433a-20.jpg');
  for(const file of openingFiles) assert.equal((await fetch(result.url+'/'+file)).status,200,file);
  for(const file of ['apps-script.gs','tests/fixtures.mjs','tests/harness.mjs','.git/config','.env','index.html','script.js','js/config.js','assets/photos/hero-main.jpg','api','_staging','_staging/stats']) assert.equal((await fetch(result.url+'/'+file)).status,404,file);
  assert.equal((await fetch(result.url+'/api',{method:'POST',body:'{}'})).status,405);
  assert.equal((await fetch(result.url+'/frontend-v2/',{headers:{Origin:'https://example.invalid'}})).status,403);
 } finally {await new Promise(resolve=>result.server.close(resolve));}
});

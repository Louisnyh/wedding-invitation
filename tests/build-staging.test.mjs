import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build,root,shippedFiles} from '../scripts/build.mjs';
import {startStaging} from '../scripts/staging.mjs';
import {TOKEN_A} from './fixtures.mjs';
test('build ships only approved static files, unchanged CSS/photos, no legacy endpoints or synthetic fixtures',async()=>{
 const dist=await build();const files=(await readdir(dist,{recursive:true,withFileTypes:true})).filter(item=>item.isFile()).map(item=>(item.parentPath+'/'+item.name).slice(dist.length+1));assert.deepEqual(files.sort(),[...shippedFiles].sort());
 for(const file of ['style.css','assets/photos/hero-main.webp','assets/photos/story-01.webp','assets/photos/personal-note.webp']){
  const original=execFileSync('git',['show',`HEAD:${file}`],{cwd:root,maxBuffer:2e6});assert.deepEqual(await readFile(`${dist}/${file}`),original);
 }
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

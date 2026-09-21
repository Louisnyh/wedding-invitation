import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../js/api.js';
import {validateResponse,safeMapUrl} from '../js/schema.js';
import {createRsvpState,changeRsvp,editRsvp,startSaving,finishSaving} from '../js/rsvp-state.js';
import {tablePresentation} from '../js/table-check.js';
import {createHarness} from './harness.mjs';
import {TOKEN_A} from './fixtures.mjs';
const saved={status:null,partySize:null,partyLimit:3,under5ChildCount:null,dietaryRequirements:'',privateNote:''};
for(const status of ['attending','unsure','unable'])test(`selecting ${status} only selects; explicit save required`,()=>{
 let state=changeRsvp(createRsvpState(saved),'status',status);if(status==='attending')state=changeRsvp(state,'under5ChildCount','0');assert.equal(state.requestId,null);assert.equal(state.submitted,null);
 const next=startSaving(state,()=> 'a'.repeat(32));assert.equal(next.state.phase,'saving');assert.equal(next.payload.status,status);
});
test('editing and recoverable errors preserve the exact draft and retry identity',()=>{
 let state=changeRsvp(createRsvpState(saved),'status','attending');state=changeRsvp(state,'partySize','2');state=changeRsvp(state,'under5ChildCount','0');state=changeRsvp(state,'privateNote','  =literal\n');
 const next=startSaving(state,()=> 'a'.repeat(32));state=finishSaving(next.state,{state:'temporary_error'});
 assert.equal(state.phase,'recoverable_error');assert.deepEqual(state.draft,next.state.draft);assert.equal(startSaving(state,()=> 'b'.repeat(32)).payload.requestId,'a'.repeat(32));
 state=changeRsvp(state,'privateNote','edited');assert.equal(startSaving(state,()=> 'b'.repeat(32)).payload.requestId,'b'.repeat(32));
});
test('saving cannot be double-submitted or edited',()=>{
 const state=startSaving(changeRsvp(createRsvpState(saved),'status','unable'),()=> 'a'.repeat(32)).state;
 assert.equal(startSaving(state).payload,null);assert.equal(changeRsvp(state,'status','attending'),state);assert.equal(editRsvp(state),state);
});
test('saved form data prefills on edit including private fields owned by this guest',()=>{
 const value={...saved,status:'attending',partySize:2,under5ChildCount:1,dietaryRequirements:'no nuts',privateNote:'hello'};
 const state=editRsvp(createRsvpState(value));assert.equal(state.phase,'editing');assert.deepEqual(state.draft,{status:'attending',partySize:'2',under5ChildCount:'1',dietaryRequirements:'no nuts',privateNote:'hello'});
});
test('switching away from attending omits attendance fields from the request',()=>{
 const state=changeRsvp(createRsvpState({...saved,status:'attending',partySize:2,under5ChildCount:1,dietaryRequirements:'nuts'}),'status','unsure');
 const {payload}=startSaving(state,()=> 'a'.repeat(32));assert.equal(payload.partySize,null);assert.equal(payload.under5ChildCount,null);assert.equal(payload.dietaryRequirements,'');assert.equal(state.draft.under5ChildCount,'1');assert.equal(state.draft.dietaryRequirements,'nuts');
});
for(const partySize of ['','0','-1','1.5','1e0','2people',' 2','02','4'])test(`client rejects invalid integer ${partySize}`,()=>{
 let state=changeRsvp(changeRsvp(createRsvpState(saved),'status','attending'),'partySize',partySize);state=changeRsvp(state,'under5ChildCount','0');assert.equal(startSaving(state).payload,null);
});
for(const childCount of ['0','1','2'])test(`client accepts under-5 child count ${childCount}`,()=>{
 let state=changeRsvp(createRsvpState(saved),'status','attending');state=changeRsvp(state,'partySize','3');state=changeRsvp(state,'under5ChildCount',childCount);
 assert.equal(startSaving(state,()=> 'a'.repeat(32)).payload.under5ChildCount,Number(childCount));
});
for(const childCount of ['', '-1','1.5','one','4'])test(`client rejects under-5 child count ${childCount}`,()=>{
 let state=changeRsvp(createRsvpState(saved),'status','attending');state=changeRsvp(state,'partySize','3');state=changeRsvp(state,'under5ChildCount',childCount);
 assert.equal(startSaving(state).payload,null);
});
test('legacy attending response keeps child count unknown and requires an explicit value on edit',()=>{
 const legacy={...saved,status:'attending',partySize:2,under5ChildCount:null};let state=editRsvp(createRsvpState(legacy));
 assert.equal(state.draft.under5ChildCount,'');assert.equal(startSaving(state).payload,null);
 state=changeRsvp(state,'under5ChildCount','0');assert.equal(startSaving(state,()=> 'a'.repeat(32)).payload.under5ChildCount,0);
});
test('API transports only via POST body, no credentials/referrer/cache, and validates schema',async()=>{
 const h=createHarness();let captured;
 const api=createApi({url:'/api',token:TOKEN_A,fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,json:async()=>h.post(JSON.parse(options.body))};}});
 assert.equal((await api('invitation')).state,'ready');assert.equal(captured.url,'/api');assert.equal(captured.options.method,'POST');assert.equal(captured.options.credentials,'omit');assert.equal(captured.options.referrerPolicy,'no-referrer');assert.equal(captured.options.cache,'no-store');
});
test('unconfigured frontend makes no network request',async()=>{
 const api=createApi({url:'',token:TOKEN_A,fetchImpl:()=>assert.fail('network forbidden')});assert.equal((await api('invitation')).state,'temporary_error');
});
test('network error, malformed JSON and v1 payload cannot bypass v2 validation',async()=>{
 for(const fetchImpl of [async()=>{throw Error('secret');},async()=>({ok:true,json:async()=>{throw Error();}}),async()=>({ok:true,json:async()=>({success:true,guest:{token:'SECRET'}})})]) {
  const api=createApi({url:'/api',token:TOKEN_A,fetchImpl});assert.deepEqual(await api('invitation'),{schemaVersion:2,state:'temporary_error'});
 }
});
test('timeout aborts and remains recoverable',async()=>{
 const api=createApi({url:'/api',token:TOKEN_A,timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('abort'))))});
 assert.equal((await api('invitation')).state,'temporary_error');
});
test('schema rejects forbidden nested properties and locked seating data',()=>{
 const response=createHarness().post({action:'invitation',token:TOKEN_A});
 for(const change of [r=>r.guest.token='secret',r=>r.tableCheck.assignment={name:'hidden'},r=>r.rsvp.guest_id='internal',r=>r.messages=[],r=>r.event.internal='private']){const r=structuredClone(response);change(r);assert.throws(()=>validateResponse(r));}
});
for(const url of ['javascript:alert(1)','https://waze.com.evil.invalid/','https://evil@waze.com/','https://waze.com:444/','https://waze.com/\\evil','https://www.google.com/search?q=x'])test(`unsafe navigation rejected: ${url}`,()=>assert.equal(safeMapUrl(url,'waze'),''));
test('all table states have explicit copy and no browser date calculation',()=>{
 for(const state of ['loading','locked','available','assignment_pending','temporary_error','invalid_invitation'])assert.ok(tablePresentation({state,reason:'scheduled',releaseDate:'2026-11-28',assignment:{name:'A'}}).title);
 assert.equal(tablePresentation({state:'loading'}).disabled,true);assert.equal(tablePresentation({state:'invalid_invitation'}).disabled,true);
});

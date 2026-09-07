import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './harness.mjs';
import { TOKEN_A,TOKEN_B } from './fixtures.mjs';
import { validateResponse } from '../js/schema.js';
const read = h => h.post({action:'invitation',token:TOKEN_A});
const write = (overrides={}) => ({action:'rsvp',token:TOKEN_A,requestId:'1234567890abcdef1234567890abcdef',status:'attending',partySize:2,dietaryRequirements:'',privateNote:'',...overrides});
function noLeaks(response) {
  const wire=JSON.stringify(response);
  for(const forbidden of [TOKEN_A,TOKEN_B,'synthetic-a','synthetic-b','ORGANIZER_SECRET','OTHER_GUEST','PERSONAL_SECRET','PRIVATE_INVITE','SETTINGS_SECRET','FORBIDDEN_MESSAGE','FORBIDDEN_MENU','SECRET_TABLE']) assert.ok(!wire.includes(forbidden),forbidden);
  validateResponse(response);
}
test('ready response uses exact allowlists and reads no group/message/menu/table data before release',()=>{
  const h=createHarness();const response=read(h);assert.equal(response.state,'ready');noLeaks(response);
  assert.deepEqual([...new Set(h.stats.reads)].sort(),['Guests','RSVP','Settings']);
  assert.deepEqual(response.tableCheck,{state:'locked',reason:'scheduled',releaseDate:'2026-11-28'});
});
test('available response includes only own table name, no internal IDs or table members',()=>{
  const h=createHarness({now:'2026-11-27T16:00:00Z'});const r=read(h);noLeaks(r);
  assert.deepEqual(r.tableCheck,{state:'available',assignment:{name:'测试桌位 A'}});
});
for(const date of ['2026-11-28','2026-11-27T16:00:00.000Z']) test(`Malaysia midnight boundary: ${date}`,()=>{
  const h=createHarness();h.setSetting('table_release_date',date);assert.equal(read(h).tableCheck.state,'locked');
  h.control.now='2026-11-27T16:00:00.000Z';assert.equal(read(h).tableCheck.state,'available');
});
test('native Sheet date normalized in the wedding timezone, independent of script timezone',()=>{
  const h=createHarness();h.setSetting('table_release_date',new h.context.Date('2026-11-27T16:00:00Z'));
  assert.equal(read(h).tableCheck.releaseDate,'2026-11-28');
});
for(const value of ['', 'bad', '2026-02-30','2026-02-30T00:00:00Z','2026-11-28T00:00:00']) test(`malformed release date fails closed: ${value}`,()=>{
  const h=createHarness();h.setSetting('table_release_date',value);const r=read(h);noLeaks(r);assert.deepEqual(r.tableCheck,{state:'temporary_error'});
});
test('force closed overrides past release and supplies no assignment or promised date',()=>{
  const h=createHarness({now:'2026-12-05T10:00:00Z'});h.setSetting('table_check_mode','force_closed');const r=read(h);noLeaks(r);
  assert.deepEqual(r.tableCheck,{state:'locked',reason:'force_closed',releaseDate:null});assert.ok(!h.stats.reads.includes('Tables'));
});
test('force open and assignment pending are explicit',()=>{
  const h=createHarness();h.setSetting('table_check_mode','force_open');assert.equal(read(h).tableCheck.state,'available');
  h.setCell('Guests',1,'table_id','');assert.deepEqual(read(h).tableCheck,{state:'assignment_pending'});
});
test('missing table record is pending; unavailable Tables sheet is temporary error',()=>{
  const h=createHarness();h.setSetting('table_check_mode','force_open');h.data.Tables.splice(1,1);assert.equal(read(h).tableCheck.state,'assignment_pending');
  delete h.data.Tables;assert.equal(read(h).tableCheck.state,'temporary_error');
});
for(const status of ['revoked','disabled','expired','UNKNOWN']) test(`reject ${status} on reads and writes without writes`,()=>{
  const h=createHarness();h.setCell('Guests',1,'invitation_status',status);
  assert.equal(read(h).state,'invalid_invitation');assert.equal(h.post(write()).state,'invalid_invitation');assert.equal(h.stats.writes.length,0);
});
test('expiry boundary rejects writes and unknown tokens never read other collections',()=>{
  const h=createHarness();h.setCell('Guests',1,'expires_at','2026-11-27T15:59:59Z');assert.equal(read(h).state,'invalid_invitation');
  h.stats.reads=[];assert.equal(h.post({action:'invitation',token:'cccccccccccccccc'}).state,'invalid_invitation');assert.deepEqual(h.stats.reads,['Guests']);
});
test('duplicate tokens and duplicate internal identities fail closed',()=>{
  const h=createHarness();h.setCell('Guests',2,'guest_id','synthetic-a');assert.equal(read(h).state,'invalid_invitation');
  h.setCell('Guests',2,'guest_id','synthetic-b');h.setCell('Guests',2,'token',TOKEN_A);assert.equal(read(h).state,'invalid_invitation');
});
test('revocation is rechecked after acquiring the write lock',()=>{
  const h=createHarness();h.control.onLock=()=>h.setCell('Guests',1,'invitation_status','revoked');
  assert.equal(h.post(write()).state,'invalid_invitation');assert.equal(h.stats.writes.length,0);assert.equal(h.stats.locked,false);
});
for(const count of ['',0,-1,2.5,'2.5','2people','1e0',' 2','02','+2',true,null,{},21,4]) test(`strict invalid party size ${JSON.stringify(count)}`,()=>{
  const h=createHarness();const r=h.post(write({partySize:count}));assert.equal(r.state,'validation_error');assert.ok(r.errors.partySize);assert.equal(h.stats.writes.length,0);
});
test('all RSVP options use authorized explicit writes; current own form prefills only its own fields',()=>{
  const h=createHarness();for(const [i,status] of ['attending','unsure','unable'].entries()) {
    const r=h.post(write({status,partySize:status==='attending'?3:null,requestId:String(i+1).repeat(32),privateNote:'  A private note\n'}));
    assert.equal(r.state,'saved');assert.equal(r.rsvp.status,status);assert.equal(r.rsvp.privateNote,'  A private note\n');noLeaks(r);
    assert.deepEqual(read(h).rsvp,r.rsvp);
  }
  assert.equal(h.stats.writes.length,3);assert.equal(h.data.Guests[1][5],'pending');
});
for(const value of ['=1+1','+1','-1','@SUM(A1:A2)',"'literal",'\t=1','line one\n=1','你好 💜']) test(`literal Sheet text round-trip ${JSON.stringify(value)}`,()=>{
  const h=createHarness();const r=h.post(write({dietaryRequirements:value,privateNote:value}));assert.equal(r.state,'saved');
  assert.equal(h.stats.writes[0].row[7],"'"+value);assert.equal(read(h).rsvp.privateNote,value);assert.equal(read(h).rsvp.dietaryRequirements,value);
});
test('long/control-character text rejected before write',()=>{
  const h=createHarness();assert.equal(h.post(write({privateNote:'x'.repeat(501)})).state,'validation_error');
  assert.equal(h.post(write({dietaryRequirements:'bad\u0000'})).state,'validation_error');assert.equal(h.stats.writes.length,0);
});
test('guest ID injection and obsolete action rejected',()=>{
  const h=createHarness();assert.equal(h.post(write({guest_id:'synthetic-b'})).state,'validation_error');
  assert.equal(h.post({action:'memory',token:TOKEN_A,message:'test'}).state,'invalid_invitation');assert.equal(h.stats.writes.length,0);
});
test('lost acknowledgement is retryable with exactly one append',()=>{
  const h=createHarness();h.control.loseWriteResponse=true;assert.equal(h.post(write()).state,'temporary_error');
  assert.equal(h.post(write()).state,'saved');assert.equal(h.stats.writes.length,1);
});
test('edited duplicate request ID rejected; own revisions survive physical row sorting',()=>{
  const h=createHarness();h.post(write());assert.equal(h.post(write({privateNote:'changed'})).state,'validation_error');
  h.post(write({requestId:'f'.repeat(32),privateNote:'latest'}));h.data.RSVP=[h.data.RSVP[0],...h.data.RSVP.slice(1).reverse()];
  assert.equal(read(h).rsvp.privateNote,'latest');assert.equal(h.post(write()).rsvp.privateNote,'latest');
});
test('other guest RSVP never leaks into current response',()=>{
  const h=createHarness();h.post(write({token:TOKEN_B,privateNote:'OTHER_GUEST_PRIVATE'}));const r=read(h);assert.equal(r.rsvp.status,null);noLeaks(r);
});
test('legacy history uses timestamp rather than row order; organizer notes never prefilled',()=>{
  const h=createHarness();h.data.RSVP.push(['old2','','','2026-10-02T00:00:00Z','synthetic-a','maybe','','','']);
  h.data.RSVP.push(['old1','','','2026-10-01T00:00:00Z','synthetic-a','confirmed',2,'legacy diet','']);assert.equal(read(h).rsvp.status,'unsure');
});
test('write failure and lock timeout never claim saved',()=>{
  const h=createHarness();h.control.failWrite=true;assert.equal(h.post(write()).state,'temporary_error');assert.equal(h.stats.locked,false);
  h.control.failWrite=false;h.control.lockAvailable=false;assert.equal(h.post(write()).state,'temporary_error');assert.equal(h.stats.writes.length,0);
});
test('unconfigured/disabled production guarded; GET and malformed bodies do not disclose internals',()=>{
  const h=createHarness();h.properties.ENVIRONMENT='production';assert.equal(read(h).state,'temporary_error');assert.equal(h.stats.reads.length,0);
  assert.deepEqual(JSON.parse(h.context.doGet()),{schemaVersion:2,state:'invalid_invitation'});
  for(const raw of ['not json','null','[]','"string"']) {const r=JSON.parse(h.context.doPost({postData:{contents:raw}}));assert.ok(['temporary_error','invalid_invitation'].includes(r.state));noLeaks(r);}
});
test('Sheet URLs constrained; Sheet markup is returned as plain strings for text-only rendering',()=>{
  const h=createHarness();h.setSetting('google_maps_url','javascript:alert(1)');h.setSetting('waze_url','https://waze.com.evil.invalid/');h.setCell('Guests',1,'guest_name','<img src=x onerror=alert(1)>');
  const r=read(h);assert.equal(r.event.googleMapsUrl,'');assert.equal(r.event.wazeUrl,'');assert.equal(r.guest.displayName,'<img src=x onerror=alert(1)>');validateResponse(r);
});

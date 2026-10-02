import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './harness.mjs';

const HEADERS = ['guest_id','token','guest_name','invitation_status','pax_limit','table_id','revoked','expires_at','guest_type','group_name','personal_message','invite_url'];
const ROOT = 'https://louisnyh.github.io/wedding-invitation/';
const token = character => character.repeat(64);
const url = value => `${ROOT}?token=${value}`;
const qaRow = (id='qa-prod-v2-smoke',value=token('a')) => [id,value,'TEST GUEST','active',2,'','TRUE','','qa','qa','',url(value)];
const eligibleRow = (name='Guest One',pax=2,type='family',group='Family') => ['','',name,'',pax,'','','',type,group,'Welcome',''];
const realRow = (id='guest-0001',value=token('b'),overrides={}) => {
  const row = [id,value,'Existing Guest','active',2,'','FALSE','','family','Family','Hello',url(value)];
  const map = Object.fromEntries(HEADERS.map((header,index)=>[header,index]));
  for (const [key,next] of Object.entries(overrides)) row[map[key]]=next;
  return row;
};
function credentialData(rows) {
  return {
    Guests:[HEADERS,...rows],
    RSVP:[['response_id','request_id','revision','timestamp','guest_id','rsvp_status','pax_count','under_5_child_count','dietary_notes','private_note'],['qa-response','qa-request',1,'2026-09-20','qa-prod-v2-smoke','confirmed',1,0,'','']],
    Settings:[['key','value'],['table_check_mode','force_closed']],
    Tables:[['table_id','table_name']],
    Messages:[['message']],
    Menu:[['course_name']]
  };
}
const plain = value => JSON.parse(JSON.stringify(value));
const snapshot = value => JSON.stringify(value);
const call = (context,name,...args)=>context[name](...args);

test('pure guest ID helpers parse, pad, continue beyond four digits and reject invalid IDs',()=>{
  const h=createHarness({fixtureData:credentialData([])});
  assert.equal(call(h.context,'parseRealGuestId','guest-0001'),1);
  assert.equal(call(h.context,'parseRealGuestId','guest-10000'),10000);
  assert.equal(call(h.context,'parseRealGuestId','qa-prod-v2-smoke'),null);
  assert.equal(call(h.context,'parseRealGuestId','guest-0000'),null);
  assert.equal(call(h.context,'formatRealGuestId',1),'guest-0001');
  assert.equal(call(h.context,'formatRealGuestId',10000),'guest-10000');
});

test('hex and canonical invite URL helpers are deterministic and safe',()=>{
  const h=createHarness({fixtureData:credentialData([])});
  assert.equal(call(h.context,'credentialBytesToHex',[-1,0,1,127,-128]),'ff00017f80');
  assert.equal(call(h.context,'buildCanonicalGuestInviteUrl',token('c')),url(token('c')));
});

test('zero eligible rows performs no writes',()=>{
  const h=createHarness({fixtureData:credentialData([qaRow()])});
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Eligible for generation: 0/);
  const report=call(h.context,'generateGuestCredentials');
  assert.match(report,/Generated: 0/);
  assert.equal(h.stats.writes.length,0);
});

test('one eligible guest receives four system fields and preserves human fields',()=>{
  const row=eligibleRow('Guest One',3,'friend','Friends');
  const h=createHarness({fixtureData:credentialData([row])});
  const humanBefore=plain(h.data.Guests[1].slice(2,12));
  const report=call(h.context,'generateGuestCredentials');
  assert.match(report,/Generated: 1/);
  assert.equal(h.data.Guests[1][0],'guest-0001');
  assert.match(h.data.Guests[1][1],/^[0-9a-f]{64}$/);
  assert.equal(h.data.Guests[1][3],'active');
  assert.equal(h.data.Guests[1][11],url(h.data.Guests[1][1]));
  assert.deepEqual(plain(h.data.Guests[1].slice(2,3)),humanBefore.slice(0,1));
  assert.deepEqual(plain(h.data.Guests[1].slice(4,11)),humanBefore.slice(2,9));
  assert.equal(h.stats.writes.length,4);
});

test('multiple guests receive sequential IDs and unique credentials',()=>{
  const h=createHarness({fixtureData:credentialData([eligibleRow('One'),eligibleRow('Two'),eligibleRow('Three')])});
  call(h.context,'generateGuestCredentials');
  assert.deepEqual(h.data.Guests.slice(1).map(row=>row[0]),['guest-0001','guest-0002','guest-0003']);
  assert.equal(new Set(h.data.Guests.slice(1).map(row=>row[1])).size,3);
  assert.equal(new Set(h.data.Guests.slice(1).map(row=>row[11])).size,3);
});

test('numbering starts at guest-0001 with no existing real IDs and ignores QA IDs',()=>{
  const h=createHarness({fixtureData:credentialData([qaRow('qa-prod-v2-browser',token('d')),eligibleRow()])});
  const plan=plain(call(h.context,'planGuestCredentialGeneration',h.data.Guests,true));
  assert.equal(plan.nextGuestId,'guest-0001');
  assert.equal(plan.plannedLastGuestId,'guest-0001');
});

test('numbering continues after the highest existing real ID',()=>{
  const h=createHarness({fixtureData:credentialData([realRow('guest-0007'),eligibleRow()])});
  call(h.context,'generateGuestCredentials');
  assert.equal(h.data.Guests[2][0],'guest-0008');
});

test('numbering never fills historical gaps',()=>{
  const h=createHarness({fixtureData:credentialData([realRow('guest-0001',token('b')),realRow('guest-0004',token('c')),eligibleRow()])});
  call(h.context,'generateGuestCredentials');
  assert.equal(h.data.Guests[3][0],'guest-0005');
});

test('duplicate existing guest IDs block the full generation before writes',()=>{
  const h=createHarness({fixtureData:credentialData([realRow('guest-0001',token('b')),realRow('guest-0001',token('c')),eligibleRow()])});
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/Duplicate guest_id/);
  assert.equal(h.stats.writes.length,0);
});

test('duplicate existing tokens block generation without exposing the token',()=>{
  const duplicate=token('d');
  const h=createHarness({fixtureData:credentialData([realRow('guest-0001',duplicate),realRow('guest-0002',duplicate),eligibleRow()])});
  assert.throws(()=>call(h.context,'generateGuestCredentials'),error=>/Duplicate token/.test(error.message)&&!error.message.includes(duplicate));
  assert.equal(h.stats.writes.length,0);
});

test('duplicate invite URLs block generation',()=>{
  const first=realRow('guest-0001',token('b'));
  const second=realRow('guest-0002',token('c'),{invite_url:first[11]});
  const h=createHarness({fixtureData:credentialData([first,second,eligibleRow()])});
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/Duplicate invite_url/);
  assert.equal(h.stats.writes.length,0);
});

for (const [name,row,pattern] of [
  ['invalid pax_limit',eligibleRow('Guest',0),/invalid pax_limit/],
  ['blank guest_name',['','','','',2,'','','','family','Family','',''],/missing guest_name/]
]) test(`${name} blocks generation`,()=>{
  const h=createHarness({fixtureData:credentialData([row])});
  assert.throws(()=>call(h.context,'generateGuestCredentials'),pattern);
  assert.equal(h.stats.writes.length,0);
});

test('blank optional organizer metadata produces warnings but remains eligible',()=>{
  const row=eligibleRow('Guest',2,'',''); row[10]='';
  const h=createHarness({fixtureData:credentialData([row])});
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Eligible for generation: 1/);
  assert.match(preview,/Missing optional guest_type \(warning\): 1/);
  assert.match(preview,/Missing optional group_name \(warning\): 1/);
  assert.match(preview,/Warnings: 2/);
  assert.doesNotThrow(()=>call(h.context,'generateGuestCredentials'));
  assert.equal(h.data.Guests[1][0],'guest-0001');
  assert.equal(h.data.Guests[1][8],'');
  assert.equal(h.data.Guests[1][9],'');
  assert.equal(h.data.Guests[1][10],'');
});

test('total invited pax is informational and never blocks generation above 300',()=>{
  const atCapacity=Array.from({length:15},(_,index)=>eligibleRow(`Guest ${index+1}`,20));
  const allowed=createHarness({fixtureData:credentialData(atCapacity)});
  const preview=call(allowed.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Total maximum invited pax \(informational only\): 300/);
  assert.doesNotThrow(()=>call(allowed.context,'generateGuestCredentials'));

  const overCapacity=[...atCapacity,eligibleRow('Guest 16',1)];
  const over=createHarness({fixtureData:credentialData(overCapacity)});
  const overPreview=call(over.context,'previewGuestCredentialGeneration');
  assert.match(overPreview,/Total maximum invited pax \(informational only\): 301/);
  assert.doesNotThrow(()=>call(over.context,'generateGuestCredentials'));
  assert.equal(over.data.Guests.slice(1).filter(row=>row[0]).length,16);
});

test('capacity excludes QA and revoked real guests',()=>{
  const revoked=realRow('guest-0001',token('b'),{pax_limit:20,revoked:'TRUE'});
  const h=createHarness({fixtureData:credentialData([qaRow(),revoked,eligibleRow('Active',3)])});
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Real Guest records: 2/);
  assert.match(preview,/Total maximum invited pax \(informational only\): 3/);
});

test('malformed non-QA credentialed guest ID blocks generation',()=>{
  const malformed=realRow('temporary-guest',token('f'));
  const h=createHarness({fixtureData:credentialData([malformed,eligibleRow()])});
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/malformed credentialed guest_id/);
  assert.equal(h.stats.writes.length,0);
});

test('partial credential row is reported by preview and blocks generation',()=>{
  const row=eligibleRow(); row[0]='guest-0001';
  const h=createHarness({fixtureData:credentialData([row,eligibleRow('Second')])});
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Partial credential rows: 1/);
  assert.match(preview,/Row 2 — partial credentials/);
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/partial credentials/);
  assert.equal(h.stats.writes.length,0);
});

test('missing token pepper is safely reported and blocks all writes',()=>{
  const h=createHarness({fixtureData:credentialData([eligibleRow()]),propertyOverrides:{GUEST_TOKEN_PEPPER:''}});
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Token pepper configured: NO/);
  assert.match(preview,/TOKEN PEPPER NOT CONFIGURED/);
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/TOKEN PEPPER NOT CONFIGURED/);
  assert.equal(h.stats.writes.length,0);
});

test('existing credentials and historical revoked partial QA rows remain byte-for-byte unchanged',()=>{
  const existing=realRow('guest-0003',token('b'));
  const qa=qaRow(); qa[11]='';
  const h=createHarness({fixtureData:credentialData([existing,qa,eligibleRow()])});
  const before=[snapshot(h.data.Guests[1]),snapshot(h.data.Guests[2])];
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Partial credential rows: 0/);
  assert.match(preview,/Eligible for generation: 1/);
  call(h.context,'generateGuestCredentials');
  assert.equal(snapshot(h.data.Guests[1]),before[0]);
  assert.equal(snapshot(h.data.Guests[2]),before[1]);
  assert.equal(h.data.Guests[3][0],'guest-0004');
});

test('rerun is idempotent and generates zero new credentials',()=>{
  const h=createHarness({fixtureData:credentialData([eligibleRow('One'),eligibleRow('Two')])});
  call(h.context,'generateGuestCredentials');
  const afterFirst=snapshot(h.data.Guests);
  const firstWriteCount=h.stats.writes.length;
  const second=call(h.context,'generateGuestCredentials');
  assert.match(second,/Generated: 0/);
  assert.equal(snapshot(h.data.Guests),afterFirst);
  assert.equal(h.stats.writes.length,firstWriteCount);
});

test('generated tokens are unique lowercase 64-hex and URLs are unique canonical roots',()=>{
  const h=createHarness({fixtureData:credentialData(Array.from({length:12},(_,index)=>eligibleRow(`Guest ${index+1}`)))});
  call(h.context,'generateGuestCredentials');
  const rows=h.data.Guests.slice(1);
  const tokens=rows.map(row=>row[1]);
  const urls=rows.map(row=>row[11]);
  assert.ok(tokens.every(value=>/^[0-9a-f]{64}$/.test(value)));
  assert.equal(new Set(tokens).size,tokens.length);
  assert.equal(new Set(urls).size,urls.length);
  assert.ok(rows.every(row=>row[11]===url(row[1])&&!/release-v2|candidate-v2|localhost|staging/.test(row[11])));
});

test('RSVP, Tables and Settings remain unchanged during generation and verification',()=>{
  const h=createHarness({fixtureData:credentialData([eligibleRow()])});
  const before={RSVP:snapshot(h.data.RSVP),Tables:snapshot(h.data.Tables),Settings:snapshot(h.data.Settings)};
  call(h.context,'generateGuestCredentials');
  call(h.context,'verifyGuestCredentials');
  assert.deepEqual({RSVP:snapshot(h.data.RSVP),Tables:snapshot(h.data.Tables),Settings:snapshot(h.data.Settings)},before);
  assert.ok(h.stats.writes.every(write=>write.name==='Guests'));
});

test('script lock failure aborts safely before reading or writing',()=>{
  const h=createHarness({fixtureData:credentialData([eligibleRow()])});
  h.control.lockAvailable=false;
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/script lock unavailable/);
  assert.equal(h.stats.writes.length,0);
  assert.equal(h.stats.locked,false);
});

test('preview is read-only and never logs tokens or tokenized URLs',()=>{
  const existing=realRow('guest-0001',token('e'));
  const h=createHarness({fixtureData:credentialData([existing,eligibleRow()])});
  const before=snapshot(h.data);
  const report=call(h.context,'previewGuestCredentialGeneration');
  assert.equal(snapshot(h.data),before);
  assert.equal(h.stats.writes.length,0);
  assert.ok(!report.includes(token('e')));
  assert.ok(!report.includes('?token='));
});

test('verification returns safe aggregate counts without raw credentials',()=>{
  const h=createHarness({fixtureData:credentialData([qaRow(),eligibleRow('One'),eligibleRow('Two')])});
  call(h.context,'generateGuestCredentials');
  const report=call(h.context,'verifyGuestCredentials');
  assert.match(report,/Real Guests: 2/);
  assert.match(report,/2 valid 64-hex/);
  assert.match(report,/2 canonical/);
  assert.match(report,/QA Guests: 1/);
  assert.match(report,/QA revoked: 1/);
  assert.match(report,/Total maximum invited pax \(informational only\): 4/);
  assert.match(report,/RSVP rows: 1/);
  assert.match(report,/Tables rows: 0/);
  assert.match(report,/RSVP \/ Tables: UNCHANGED/);
  assert.ok(!report.includes('?token='));
  for (const row of h.data.Guests.slice(1)) assert.ok(!report.includes(row[1]));
});

test('duplicate guest names are warnings only',()=>{
  const h=createHarness({fixtureData:credentialData([eligibleRow('Same Name'),eligibleRow('Same Name')])});
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Eligible for generation: 2/);
  assert.match(preview,/Warnings: 1/);
  assert.doesNotThrow(()=>call(h.context,'generateGuestCredentials'));
});

test('approved Guests headers must exist in their exact schema and order',()=>{
  const data=credentialData([eligibleRow()]);
  data.Guests[0]=data.Guests[0].filter(header=>header!=='guest_type');
  data.Guests[1]=data.Guests[1].slice(0,8).concat(data.Guests[1].slice(9));
  const h=createHarness({fixtureData:data});
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/approved schema and order|exactly 12 columns/);
  assert.equal(h.stats.writes.length,0);
});

test('blank physical columns after the approved schema are ignored safely',()=>{
  const data=credentialData([eligibleRow()]);
  data.Guests=data.Guests.map(row=>row.concat(Array(14).fill('')));
  const h=createHarness({fixtureData:data});
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Eligible for generation: 1/);
  assert.doesNotThrow(()=>call(h.context,'generateGuestCredentials'));
});

test('known organizer-only columns are preserved and excluded from credential logic',()=>{
  const data=credentialData([eligibleRow()]);
  data.Guests[0]=data.Guests[0].concat(['Ready?','Remark']);
  data.Guests[1]=data.Guests[1].concat(['TRUE','Organizer note']);
  const h=createHarness({fixtureData:data});
  const organizerBefore=snapshot(h.data.Guests.map(row=>row.slice(12)));
  const preview=call(h.context,'previewGuestCredentialGeneration');
  assert.match(preview,/Eligible for generation: 1/);
  call(h.context,'generateGuestCredentials');
  assert.equal(snapshot(h.data.Guests.map(row=>row.slice(12))),organizerBefore);
});

test('nonblank data after the approved schema blocks generation',()=>{
  const data=credentialData([eligibleRow()]);
  data.Guests[0]=data.Guests[0].concat(Array(14).fill(''));
  data.Guests[1]=data.Guests[1].concat(['unexpected']);
  const h=createHarness({fixtureData:data});
  assert.throws(()=>call(h.context,'generateGuestCredentials'),/data beyond the approved 12 columns/);
  assert.equal(h.stats.writes.length,0);
});

test('generator functions are not public API actions',()=>{
  const h=createHarness();
  for (const action of ['previewGuestCredentialGeneration','generateGuestCredentials','verifyGuestCredentials']) {
    const response=h.post({action,token:'a'.repeat(32)});
    assert.equal(response.state,'invalid_invitation');
  }
  assert.equal(h.stats.writes.length,0);
});

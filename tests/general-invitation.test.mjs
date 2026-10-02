import test from 'node:test';
import assert from 'node:assert/strict';
import {captureInvitationContext,generalGuestNameError,GENERAL_INVITE_PARTY_LIMIT} from '../frontend-v2/scripts/rsvp-adapter.js';
import {createApi} from '../js/api.js';
import {validateResponse} from '../js/schema.js';
import {createHarness} from './harness.mjs';
import {fixtures,TOKEN_A} from './fixtures.mjs';

const requestId='1234567890abcdef1234567890abcdef';
const general=(overrides={})=>({
  action:'general_registration',requestId,guestName:'Aisyah & Family',status:'attending',partySize:2,
  under5ChildCount:0,dietaryRequirements:'',privateNote:'',website:'',...overrides
});
const locationFor=search=>({search,pathname:'/wedding-invitation/',hash:''});
const historySpy=()=>{const calls=[];return {calls,state:null,replaceState:(...args)=>calls.push(args)};};

test('every General Invite uses the fixed six-person party limit',()=>assert.equal(GENERAL_INVITE_PARTY_LIMIT,6));

test('?invite=general activates General Mode without a token',()=>{
  const history=historySpy();
  assert.deepEqual(captureInvitationContext({locationLike:locationFor('?invite=general'),historyLike:history,previewToken:''}),{mode:'general',token:''});
  assert.deepEqual(history.calls,[]);
});

test('General Mode takes precedence over PREVIEW_TOKEN',()=>{
  assert.deepEqual(captureInvitationContext({locationLike:locationFor('?invite=general'),historyLike:historySpy(),previewToken:TOKEN_A}),{mode:'general',token:''});
});

test('personalized token mode remains unchanged and cleans credentials from the URL',()=>{
  const history=historySpy();
  assert.deepEqual(captureInvitationContext({locationLike:locationFor(`?token=${TOKEN_A}&lang=en`),historyLike:history,previewToken:''}),{mode:'personalized',token:TOKEN_A});
  assert.deepEqual(history.calls,[[null,'','/wedding-invitation/?lang=en']]);
});

test('valid token wins over a simultaneous general flag and removes both flags',()=>{
  const history=historySpy();
  assert.equal(captureInvitationContext({locationLike:locationFor(`?invite=general&token=${TOKEN_A}`),historyLike:history,previewToken:''}).mode,'personalized');
  assert.deepEqual(history.calls,[[null,'','/wedding-invitation/']]);
});

test('invalid explicit token never falls through to General Mode',()=>{
  assert.deepEqual(captureInvitationContext({locationLike:locationFor('?token=bad&invite=general'),historyLike:historySpy(),previewToken:TOKEN_A}),{mode:'invalid',token:''});
});

test('General Page 08 rejects blank and whitespace-only names',()=>{
  assert.match(generalGuestNameError(''),/Please enter your name/);
  assert.match(generalGuestNameError(' \n '),/Please enter your name/);
});

for(const name of ['Ahmad Rahman','Priya Nair','陈小明','Aisyah & Family']) test(`General Page 08 accepts Unicode name: ${name}`,()=>{
  assert.equal(generalGuestNameError(name),'');
});

test('General Page 08 accepts 120 characters and rejects 121',()=>{
  assert.equal(generalGuestNameError('名'.repeat(120)),'');
  assert.match(generalGuestNameError('名'.repeat(121)),/120 characters/);
});

test('General registration creates exactly one Guest and one RSVP row',()=>{
  const h=createHarness();const before={guests:h.data.Guests.length,rsvp:h.data.RSVP.length};const response=h.post(general());
  assert.equal(response.state,'registered');assert.equal(h.data.Guests.length,before.guests+1);assert.equal(h.data.RSVP.length,before.rsvp+1);
  assert.deepEqual(h.stats.writes.map(write=>write.name),['Guests','RSVP']);
});

test('new General Guest receives the next never-reused guest ID',()=>{
  const h=createHarness();h.data.Guests[1][0]='guest-0007';h.data.Guests[2][0]='guest-0010';h.post(general());
  assert.equal(h.data.Guests.at(-1)[0],'guest-0011');
});

test('QA IDs do not participate in General Guest numbering',()=>{
  const data=fixtures();
  data.Guests.push(['qa-prod-v2-smoke','c'.repeat(64),'QA','revoked',2,'','TRUE','','qa','qa','','https://louisnyh.github.io/wedding-invitation/?token='+'c'.repeat(64)]);
  const h=createHarness({fixtureData:data});h.post(general());assert.equal(h.data.Guests.at(-1)[0],'guest-0003');
});

test('new General token is unique lowercase 64-hex',()=>{
  const h=createHarness();h.post(general());const token=h.data.Guests.at(-1)[1];
  assert.match(token,/^[a-f0-9]{64}$/);assert.equal(h.data.Guests.filter(row=>row[1]===token).length,1);
});

test('General personal invite URL is canonical and matches its token',()=>{
  const h=createHarness();const response=h.post(general());const row=h.data.Guests.at(-1);
  assert.equal(row[11],`https://louisnyh.github.io/wedding-invitation/?token=${row[1]}`);assert.equal(response.personalInviteUrl,row[11]);
});

test('General Guest receives only the approved managed metadata',()=>{
  const h=createHarness();h.post(general({guestName:'  陈小明  '}));const row=h.data.Guests.at(-1);
  assert.deepEqual(row.slice(2,12),['陈小明','active',6,'','','','General','General Invite','',row[11]]);
});

for(const partySize of [1,6]) test(`General attending registration accepts party size ${partySize}`,()=>{
  const h=createHarness();const response=h.post(general({partySize}));
  assert.equal(response.state,'registered');assert.equal(response.rsvp.partySize,partySize);assert.equal(response.rsvp.partyLimit,6);
  assert.equal(h.data.Guests.at(-1)[4],6);assert.equal(h.data.RSVP.at(-1)[6],partySize);
});

test('General registration appends RSVP revision 1 with the same new guest ID',()=>{
  const h=createHarness();h.post(general({dietaryRequirements:'素食'}));const guest=h.data.Guests.at(-1);const rsvp=h.data.RSVP.at(-1);
  assert.equal(rsvp[2],1);assert.equal(rsvp[4],guest[0]);assert.equal(rsvp[5],'confirmed');assert.equal(rsvp[8],'素食');
});

test('identical General retry is idempotent and returns the original link',()=>{
  const h=createHarness();const first=h.post(general());const rows={guests:h.data.Guests.length,rsvp:h.data.RSVP.length,writes:h.stats.writes.length};
  const retry=h.post(general());assert.equal(retry.state,'registered');assert.equal(retry.personalInviteUrl,first.personalInviteUrl);
  assert.deepEqual({guests:h.data.Guests.length,rsvp:h.data.RSVP.length,writes:h.stats.writes.length},rows);
});

test('lost General acknowledgement retries to the original Guest and RSVP only',()=>{
  const h=createHarness();h.control.loseGeneralResponse=true;
  assert.equal(h.post(general()).state,'temporary_error');const persisted={guest:h.data.Guests.at(-1).slice(),rsvp:h.data.RSVP.at(-1).slice()};
  const retry=h.post(general());assert.equal(retry.state,'registered');assert.equal(h.data.Guests.length,4);assert.equal(h.data.RSVP.length,2);
  assert.deepEqual(h.data.Guests.at(-1),persisted.guest);assert.deepEqual(h.data.RSVP.at(-1),persisted.rsvp);
});

test('changed RSVP payload with the same General request ID fails closed',()=>{
  const h=createHarness();h.post(general());const retry=h.post(general({partySize:3}));
  assert.equal(retry.state,'validation_error');assert.ok(retry.errors.form);assert.equal(h.data.Guests.length,4);assert.equal(h.data.RSVP.length,2);
});

test('changed name with the same General request ID fails closed',()=>{
  const h=createHarness();h.post(general());const retry=h.post(general({guestName:'Another Person'}));
  assert.equal(retry.state,'validation_error');assert.ok(retry.errors.form);assert.equal(h.data.Guests.length,4);
});

test('request ID owned by a personalized RSVP never reveals another credential',()=>{
  const h=createHarness();h.data.RSVP.push(['existing',requestId,1,'2026-10-01T00:00:00Z','guest-0001','confirmed',2,0,'','']);
  const response=h.post(general());assert.equal(response.state,'validation_error');assert.equal('personalInviteUrl' in response,false);assert.equal(h.data.Guests.length,3);
});

test('General registration still works when informational maximum invited pax exceeds 300',()=>{
  const data=fixtures();
  for(let number=3;number<=17;number+=1){const token=number.toString(16).padStart(64,'0');data.Guests.push([`guest-${String(number).padStart(4,'0')}`,token,`Guest ${number}`,'active',20,'','','','family','General','','https://louisnyh.github.io/wedding-invitation/?token='+token]);}
  const h=createHarness({fixtureData:data});const response=h.post(general());assert.equal(response.state,'registered');assert.equal(h.data.Guests.at(-1)[0],'guest-0018');
});

test('QA Guests remain byte-for-byte unchanged during General registration',()=>{
  const data=fixtures();const qa=['qa-prod-v2-smoke','c'.repeat(64),'QA','revoked',2,'','TRUE','','qa','qa','','https://louisnyh.github.io/wedding-invitation/?token='+'c'.repeat(64)];data.Guests.push(qa);
  const h=createHarness({fixtureData:data});const before=JSON.stringify(h.data.Guests.at(-1));assert.equal(h.post(general()).state,'registered');assert.equal(JSON.stringify(h.data.Guests.at(-2)),before);
});

test('honeypot submissions fail before any write',()=>{
  const h=createHarness();const response=h.post(general({website:'https://spam.invalid'}));assert.equal(response.state,'validation_error');assert.equal(h.stats.writes.length,0);
});

test('server rejects blank names and preserves Unicode names exactly after trim',()=>{
  const blank=createHarness();assert.equal(blank.post(general({guestName:'   '})).state,'validation_error');assert.equal(blank.stats.writes.length,0);
  const unicode=createHarness();assert.equal(unicode.post(general({guestName:'  Priya 陈 & Family  '})).state,'registered');assert.equal(unicode.data.Guests.at(-1)[2],'Priya 陈 & Family');
});

test('server rejects General party size 7 before any write',()=>{
  const h=createHarness();const response=h.post(general({partySize:7}));assert.equal(response.state,'validation_error');assert.ok(response.errors.partySize);assert.equal(h.stats.writes.length,0);
});

test('server rejects an under-5 count greater than party size',()=>{
  const h=createHarness();const response=h.post(general({partySize:2,under5ChildCount:3}));assert.equal(response.state,'validation_error');assert.ok(response.errors.under5ChildCount);
});

for(const status of ['unsure','unable']) test(`General ${status} stores normalized attendance values`,()=>{
  const h=createHarness();const response=h.post(general({status,partySize:null,under5ChildCount:null,dietaryRequirements:'',privateNote:status==='unable'?'Best wishes':''}));
  assert.equal(response.state,'registered');assert.equal(response.rsvp.partySize,null);assert.equal(response.rsvp.partyLimit,6);assert.equal(response.rsvp.under5ChildCount,null);assert.equal(response.rsvp.privateNote,status==='unable'?'Best wishes':'');
  assert.equal(h.data.Guests.at(-1)[4],6);
});

test('initial General attendance never redefines the stored six-person limit',()=>{
  const h=createHarness();const registered=h.post(general({partySize:3}));const token=h.data.Guests.at(-1)[1];
  assert.equal(registered.rsvp.partySize,3);assert.equal(registered.rsvp.partyLimit,6);assert.equal(h.data.Guests.at(-1)[4],6);
  const invitation=h.post({action:'invitation',token});assert.equal(invitation.state,'ready');assert.equal(invitation.rsvp.partySize,3);assert.equal(invitation.rsvp.partyLimit,6);
});

test('future personalized edits may increase a General Guest RSVP up to 6',()=>{
  const h=createHarness();h.post(general({partySize:3}));const token=h.data.Guests.at(-1)[1];
  const response=h.post({action:'rsvp',token,requestId:'abcdefabcdefabcdefabcdefabcdefab',status:'attending',partySize:6,under5ChildCount:0,dietaryRequirements:'',privateNote:''});
  assert.equal(response.state,'saved');assert.equal(response.rsvp.partySize,6);assert.equal(response.rsvp.partyLimit,6);assert.equal(h.data.RSVP.at(-1)[2],2);
});

test('future personalized edits cannot exceed a General Guest limit of 6',()=>{
  const h=createHarness();h.post(general({partySize:3}));const token=h.data.Guests.at(-1)[1];const before=h.data.RSVP.length;
  const response=h.post({action:'rsvp',token,requestId:'abcdefabcdefabcdefabcdefabcdefab',status:'attending',partySize:7,under5ChildCount:0,dietaryRequirements:'',privateNote:''});
  assert.equal(response.state,'validation_error');assert.ok(response.errors.partySize);assert.equal(h.data.RSVP.length,before);
});

test('definitive RSVP append failure rolls back only the newly-created General Guest',()=>{
  const h=createHarness();const before=h.data.Guests.map(row=>row.slice());h.control.failWriteName='RSVP';
  const response=h.post(general());assert.equal(response.state,'temporary_error');assert.deepEqual(h.data.Guests,before);
  assert.equal(h.data.RSVP.length,1);assert.equal(h.stats.writes.filter(write=>write.deleteRow).length,1);
});

test('missing token pepper and lock failure fail without writes',()=>{
  const noPepper=createHarness({propertyOverrides:{GUEST_TOKEN_PEPPER:''}});assert.equal(noPepper.post(general()).state,'temporary_error');assert.equal(noPepper.stats.writes.length,0);
  const noLock=createHarness();noLock.control.lockAvailable=false;assert.equal(noLock.post(general()).state,'temporary_error');assert.equal(noLock.stats.writes.length,0);
});

test('General registration never logs tokens, URLs, pepper, or payload text',()=>{
  const h=createHarness();const response=h.post(general({privateNote:'PRIVATE GENERAL NOTE'}));const token=h.data.Guests.at(-1)[1];
  assert.equal(h.stats.logs.length,0);assert.equal(JSON.stringify(h.stats.logs).includes(token),false);assert.equal(JSON.stringify(h.stats.logs).includes(response.personalInviteUrl),false);assert.equal(JSON.stringify(h.stats.logs).includes('PRIVATE GENERAL NOTE'),false);
});

test('General API transport sends no token field and validates the registered response',async()=>{
  const h=createHarness();let body;
  const api=createApi({url:'/api',token:'',fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>h.post(body)};}});
  const response=await api('general_registration',Object.fromEntries(Object.entries(general()).filter(([key])=>key!=='action')));
  assert.equal(response.state,'registered');assert.equal('token' in body,false);assert.doesNotThrow(()=>validateResponse(response));
});

test('registered schema rejects noncanonical or short-token personal links',()=>{
  const h=createHarness();const response=h.post(general());
  for(const value of ['https://evil.invalid/?token='+'a'.repeat(64),'https://louisnyh.github.io/wedding-invitation/?token=short']){
    const changed={...response,personalInviteUrl:value};assert.throws(()=>validateResponse(changed));
  }
});

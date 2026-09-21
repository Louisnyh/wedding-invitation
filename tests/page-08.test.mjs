import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SUCCESS_COPY,captureInvitationToken,parseDietaryRequirements,formatDietaryRequirements,applyDietarySelection,page08Errors,syncDietaryDraft} from '../frontend-v2/scripts/rsvp-adapter.js';
import {createRsvpState,editRsvp,startSaving} from '../js/rsvp-state.js';

const details={allergyDetail:'花生、坚果',otherDetail:'低盐'};
const baseErrors={status:'attending',partySize:'3',partyLimit:3,childPresence:'no',childCount:'1',dietarySelections:['none'],allergyDetail:'',otherDetail:''};
const saved=(status,privateNote='')=>({status,partySize:status==='attending'?2:null,partyLimit:3,under5ChildCount:status==='attending'?0:null,dietaryRequirements:status==='attending'?'素食':'',privateNote});

test('invitation bootstrap captures a valid query token and removes it without reloading',()=>{
  const calls=[];
  const token='a'.repeat(64);
  const captured=captureInvitationToken({
    locationLike:{search:`?token=${token}`,pathname:'/wedding-invitation/',hash:''},
    historyLike:{state:{page:8},replaceState:(...args)=>calls.push(args)},
    previewToken:''
  });
  assert.equal(captured,token);
  assert.deepEqual(calls,[[{page:8},'','/wedding-invitation/']]);
});

test('invitation bootstrap preserves unrelated query values and the fragment',()=>{
  const calls=[];
  const token='b'.repeat(32);
  const captured=captureInvitationToken({
    locationLike:{search:`?lang=zh&token=${token}&view=compact`,pathname:'/wedding-invitation/',hash:'#rsvp'},
    historyLike:{state:null,replaceState:(...args)=>calls.push(args)},
    previewToken:''
  });
  assert.equal(captured,token);
  assert.deepEqual(calls,[[null,'','/wedding-invitation/?lang=zh&view=compact#rsvp']]);
});

test('invitation bootstrap keeps the approved preview token in memory without changing a clean URL',()=>{
  const calls=[];
  const previewToken='c'.repeat(16);
  const captured=captureInvitationToken({
    locationLike:{search:'?lang=en',pathname:'/frontend-v2/',hash:''},
    historyLike:{state:null,replaceState:(...args)=>calls.push(args)},
    previewToken
  });
  assert.equal(captured,previewToken);
  assert.deepEqual(calls,[]);
});

test('invitation bootstrap rejects invalid query credentials and still cleans the URL',()=>{
  const calls=[];
  const captured=captureInvitationToken({
    locationLike:{search:'?token=not-a-token&lang=en',pathname:'/wedding-invitation/',hash:''},
    historyLike:{state:null,replaceState:(...args)=>calls.push(args)},
    previewToken:'d'.repeat(16)
  });
  assert.equal(captured,'');
  assert.deepEqual(calls,[[null,'','/wedding-invitation/?lang=en']]);
});

test('Page 08 formats every approved dietary combination',()=>{
  assert.equal(formatDietaryRequirements(['vegetarian'],details),'素食');
  assert.equal(formatDietaryRequirements(['allergy'],details),'食物敏感或过敏：花生、坚果');
  assert.equal(formatDietaryRequirements(['vegetarian','allergy'],details),'素食；食物敏感或过敏：花生、坚果');
  assert.equal(formatDietaryRequirements(['vegetarian','other'],details),'素食；其他：低盐');
  assert.equal(formatDietaryRequirements(['allergy','other'],details),'食物敏感或过敏：花生、坚果；其他：低盐');
  assert.equal(formatDietaryRequirements(['vegetarian','allergy','other'],details),'素食；食物敏感或过敏：花生、坚果；其他：低盐');
  assert.equal(formatDietaryRequirements(['none'],details),'');
});

test('Page 08 parses combined and historical dietary text safely',()=>{
  assert.deepEqual(parseDietaryRequirements('素食；食物敏感或过敏：花生；其他：低盐'),{selections:['vegetarian','allergy','other'],allergyDetail:'花生',otherDetail:'低盐'});
  assert.deepEqual(parseDietaryRequirements('legacy free text'),{selections:['other'],allergyDetail:'',otherDetail:'legacy free text'});
  assert.deepEqual(parseDietaryRequirements(''),{selections:['none'],allergyDetail:'',otherDetail:''});
});

test('selecting no dietary needs clears every requirement and its details',()=>{
  assert.deepEqual(applyDietarySelection(['vegetarian','allergy','other'],'none',true),{selections:['none'],clearDetails:true});
});

test('selecting a dietary requirement clears none and preserves multi-select',()=>{
  assert.deepEqual(applyDietarySelection(['none'],'vegetarian',true),{selections:['vegetarian'],clearDetails:false});
  assert.deepEqual(applyDietarySelection(['vegetarian'],'allergy',true),{selections:['vegetarian','allergy'],clearDetails:false});
});

test('Page 08 requires an explicit under-5 answer and valid attending counts',()=>{
  assert.ok(page08Errors({...baseErrors,childPresence:''}).childPresence);
  assert.deepEqual(page08Errors(baseErrors),{});
  assert.ok(page08Errors({...baseErrors,childPresence:'yes',childCount:'4'}).childCount);
  assert.ok(page08Errors({...baseErrors,childPresence:'yes',childCount:'1.5'}).childCount);
});

test('missing allergy detail blocks save',()=>{
  assert.ok(page08Errors({...baseErrors,dietarySelections:['allergy']}).allergyDetail);
  assert.deepEqual(page08Errors({...baseErrors,dietarySelections:['allergy'],allergyDetail:'花生'}),{});
});

test('missing other detail blocks save independently',()=>{
  assert.ok(page08Errors({...baseErrors,dietarySelections:['other']}).otherDetail);
  const errors=page08Errors({...baseErrors,dietarySelections:['allergy','other']});
  assert.ok(errors.allergyDetail);assert.ok(errors.otherDetail);
});

test('Page 08 unchanged combined dietary retry preserves request identity',()=>{
  const value='素食；食物敏感或过敏：花生';
  const retry={phase:'recoverable_error',requestId:'a'.repeat(32),draft:{dietaryRequirements:value}};
  assert.equal(syncDietaryDraft(retry,true,['vegetarian','allergy'],{allergyDetail:'花生',otherDetail:''}),retry);
  const changed=syncDietaryDraft(retry,true,['vegetarian','allergy'],{allergyDetail:'牛奶',otherDetail:''});
  assert.equal(changed.requestId,null);assert.equal(changed.draft.dietaryRequirements,'素食；食物敏感或过敏：牛奶');
});

test('unable saves with or without privateNote',()=>{
  for(const note of ['','祝你们幸福快乐！']) {
    const state=createRsvpState(saved('unable',note));const next=startSaving(editRsvp(state),()=> 'b'.repeat(32));
    assert.equal(next.payload.privateNote,note);assert.equal(next.payload.status,'unable');
  }
});

test('saved unable privateNote restores when editing',()=>{
  const state=editRsvp(createRsvpState(saved('unable','祝你们幸福快乐！')));
  assert.equal(state.draft.privateNote,'祝你们幸福快乐！');
});

test('historical attending and unsure privateNote is preserved invisibly',()=>{
  for(const status of ['attending','unsure']) {
    const state=editRsvp(createRsvpState(saved(status,'历史留言')));
    const next=startSaving(state,()=> 'c'.repeat(32));
    assert.equal(next.payload.privateNote,'历史留言');
  }
});

test('privateNote field is exposed only by the unable controller state',async()=>{
  const html=await readFile(new URL('../frontend-v2/index.html',import.meta.url),'utf8');
  const adapter=await readFile(new URL('../frontend-v2/scripts/rsvp-adapter.js',import.meta.url),'utf8');
  assert.equal((html.match(/id="rsvp-unable-note"/g)||[]).length,1);
  assert.match(html,/想对我们说些什么吗？（选填）/);
  assert.match(adapter,/show\(elements\.unableNoteField,!saved && status==='unable'\)/);
  assert.doesNotMatch(adapter,/show\(elements\.unableNoteField,[^\n]*attending|show\(elements\.unableNoteField,[^\n]*unsure/);
});

test('Page 08 success copy remains distinct and never echoes privateNote',()=>{
  assert.deepEqual(Object.keys(SUCCESS_COPY),['attending','unsure','unable']);
  assert.equal(SUCCESS_COPY.attending.date,'05 · 12 · 2026');
  assert.equal(SUCCESS_COPY.unable.copy,'虽然这次没机会和你一起庆祝，希望之后还能找个时间一起吃个饭。');
  assert.equal(JSON.stringify(SUCCESS_COPY).includes('虽然这次不能一起庆祝，心意我们收到了。'),false);
  assert.notEqual(SUCCESS_COPY.attending.copy,SUCCESS_COPY.unsure.copy);
  assert.notEqual(SUCCESS_COPY.unsure.copy,SUCCESS_COPY.unable.copy);
  assert.equal(JSON.stringify(SUCCESS_COPY).includes('privateNote'),false);
});

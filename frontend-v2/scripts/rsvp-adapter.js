import { API_URL, PREVIEW_TOKEN } from '../../js/config.js';
import { createApi } from '../../js/api.js';
import { createRsvpState, changeRsvp, editRsvp, startSaving, finishSaving } from '../../js/rsvp-state.js';

const DIETARY_ORDER = ['vegetarian','allergy','other'];

export const SUCCESS_COPY = Object.freeze({
  attending: {date:'05 · 12 · 2026',copy:'那天见。'},
  unsure: {date:'',copy:'确定以后，再回来告诉我们就好。'},
  unable: {date:'',copy:'虽然这次没机会和你一起庆祝，希望之后还能找个时间一起吃个饭。'}
});

export function parseDietaryRequirements(value) {
  if (!value) return {selections:['none'],allergyDetail:'',otherDetail:''};
  const selections = new Set();
  const parsed = {selections:[],allergyDetail:'',otherDetail:''};
  const unknown = [];
  for (const part of value.split('；').map(item=>item.trim()).filter(Boolean)) {
    if (part === '素食') selections.add('vegetarian');
    else if (part.startsWith('食物敏感或过敏：')) { selections.add('allergy'); parsed.allergyDetail=part.slice('食物敏感或过敏：'.length); }
    else if (part.startsWith('其他：')) { selections.add('other'); parsed.otherDetail=part.slice('其他：'.length); }
    else unknown.push(part);
  }
  if (unknown.length) {
    selections.add('other');
    parsed.otherDetail=[parsed.otherDetail,...unknown].filter(Boolean).join('；');
  }
  parsed.selections=DIETARY_ORDER.filter(value=>selections.has(value));
  return parsed;
}

export function formatDietaryRequirements(selections, {allergyDetail='',otherDetail=''} = {}) {
  const selected = new Set(selections);
  if (!selected.size || selected.has('none')) return '';
  const parts=[];
  if(selected.has('vegetarian'))parts.push('素食');
  if(selected.has('allergy'))parts.push(`食物敏感或过敏：${allergyDetail.trim()}`);
  if(selected.has('other'))parts.push(`其他：${otherDetail.trim()}`);
  return parts.join('；');
}

export function applyDietarySelection(current, value, checked) {
  const selected = new Set(current);
  if (value === 'none' && checked) return {selections:['none'],clearDetails:true};
  if (value === 'none') selected.delete('none');
  else if (checked) { selected.delete('none'); selected.add(value); }
  else selected.delete(value);
  return {selections:[...DIETARY_ORDER,'none'].filter(value=>selected.has(value)),clearDetails:false};
}

export function syncDietaryDraft(state, dirty, selections, details) {
  if (!dirty) return state;
  const value = formatDietaryRequirements(selections, details);
  return state.draft.dietaryRequirements === value ? state : changeRsvp(state, 'dietaryRequirements', value);
}

export function page08Errors({status,partySize,partyLimit,childPresence,childCount,dietarySelections,allergyDetail,otherDetail}) {
  const errors = {};
  if (!['attending','unsure','unable'].includes(status)) errors.status = '请选择一个回复。';
  if (status !== 'attending') return errors;
  const party = Number(partySize);
  if (!Number.isInteger(party) || party < 1 || party > partyLimit) errors.partySize = `请选择 1–${partyLimit} 人。`;
  if (!['yes','no'].includes(childPresence)) errors.childPresence = '请告诉我们是否有 5 岁以下孩童随同。';
  const children = Number(childCount);
  if (childPresence === 'yes' && (!Number.isInteger(children) || children < 1 || children > party)) errors.childCount = '孩童人数不能超过出席人数。';
  const selected = new Set(dietarySelections);
  if (!selected.size || (selected.has('none') && selected.size > 1)) errors.dietarySelections = '请选择饮食需求。';
  if (selected.has('allergy') && !allergyDetail.trim()) errors.allergyDetail = '请填写食物敏感或过敏的详细说明。';
  if (selected.has('other') && !otherDetail.trim()) errors.otherDetail = '请填写其他饮食需求的详细说明。';
  return errors;
}

function setupPage08() {
  const section = document.querySelector('.rsvp');
  if (!section) return;

  const $ = selector => section.querySelector(selector);
  const elements = {
    guestName:$('#rsvp-guest-name'),loading:$('#rsvp-loading'),loadRetry:$('#rsvp-load-retry'),form:$('#rsvp-form'),
    statusGroup:$('#rsvp-status-group'),statusError:$('#rsvp-status-error'),selected:$('#rsvp-selected'),stateMessage:$('#rsvp-state-message'),
    attending:$('#rsvp-attending'),party:$('#rsvp-party-size'),partyHint:$('#rsvp-party-hint'),partyError:$('#rsvp-party-error'),
    childGroup:$('#rsvp-child-presence-group'),childPresenceError:$('#rsvp-child-presence-error'),childCountField:$('#rsvp-child-count-field'),
    childCount:$('#rsvp-child-count'),childCountError:$('#rsvp-child-count-error'),dietaryGroup:$('#rsvp-dietary-group'),
    dietaryError:$('#rsvp-dietary-error'),allergyField:$('#rsvp-allergy-detail-field'),allergyDetail:$('#rsvp-allergy-detail'),
    allergyError:$('#rsvp-allergy-detail-error'),otherField:$('#rsvp-other-detail-field'),otherDetail:$('#rsvp-other-detail'),
    otherError:$('#rsvp-other-detail-error'),unableNoteField:$('#rsvp-unable-note-field'),unableNote:$('#rsvp-unable-note'),
    unableNoteError:$('#rsvp-unable-note-error'),submit:$('#rsvp-submit'),success:$('#rsvp-success'),successDate:$('#rsvp-success-date'),
    successCopy:$('#rsvp-success-copy'),edit:$('#rsvp-edit'),announcement:$('#rsvp-announcement')
  };
  const statusInputs = [...section.querySelectorAll('input[name="rsvpStatus"]')];
  const childInputs = [...section.querySelectorAll('input[name="childPresence"]')];
  const dietaryInputs = [...section.querySelectorAll('input[name="dietarySelections"]')];
  const allergyInput = dietaryInputs.find(input=>input.value==='allergy');
  const otherInput = dietaryInputs.find(input=>input.value==='other');
  const token = new URLSearchParams(location.search).get('token') || PREVIEW_TOKEN;
  const api = createApi({url:API_URL,token});
  let rsvp = null;
  let authorized = false;
  let authEpoch = 0;
  let loading = false;
  let childPresence = '';
  let dietarySelections = [];
  let allergyDetail = '';
  let otherDetail = '';
  let dietaryDirty = false;
  let uiErrors = {};

  const show = (element,visible) => { element.hidden = !visible; };
  const setRadio = (inputs,value) => inputs.forEach(input => { input.checked = input.value === value; });
  const setChecks = values => { const selected=new Set(values);dietaryInputs.forEach(input=>{input.checked=selected.has(input.value);}); };
  const checkedValues = inputs => inputs.filter(input=>input.checked).map(input=>input.value);
  const replaceOptions = (select,min,max,value) => {
    const fragment = document.createDocumentFragment();
    for (let number=min; number<=max; number+=1) {
      const option = document.createElement('option');option.value=String(number);option.textContent=String(number);fragment.append(option);
    }
    select.replaceChildren(fragment);select.value=String(Math.min(Math.max(Number(value)||min,min),max));
  };

  function syncUiFromDraft() {
    setRadio(statusInputs,rsvp.draft.status || '');
    replaceOptions(elements.party,1,rsvp.saved.partyLimit,rsvp.draft.partySize);
    childPresence = rsvp.draft.under5ChildCount === '' ? '' : Number(rsvp.draft.under5ChildCount) === 0 ? 'no' : 'yes';
    setRadio(childInputs,childPresence);
    replaceOptions(elements.childCount,1,Number(elements.party.value),Number(rsvp.draft.under5ChildCount)||1);
    const parsed = parseDietaryRequirements(rsvp.draft.dietaryRequirements);
    dietarySelections=parsed.selections;allergyDetail=parsed.allergyDetail;otherDetail=parsed.otherDetail;dietaryDirty=false;
    setChecks(dietarySelections);elements.allergyDetail.value=allergyDetail;elements.otherDetail.value=otherDetail;
    elements.unableNote.value=rsvp.draft.privateNote;
  }

  function renderErrors() {
    const combined = {...rsvp?.errors,...uiErrors};
    elements.statusError.textContent=combined.status || '';
    elements.partyError.textContent=combined.partySize || '';
    elements.childPresenceError.textContent=combined.childPresence || combined.under5ChildCount || '';
    elements.childCountError.textContent=combined.childCount || '';
    elements.dietaryError.textContent=combined.dietarySelections || combined.dietaryRequirements || '';
    elements.allergyError.textContent=combined.allergyDetail || '';
    elements.otherError.textContent=combined.otherDetail || '';
    elements.unableNoteError.textContent=combined.privateNote || '';
    elements.statusGroup.setAttribute('aria-invalid',String(Boolean(combined.status)));
    elements.party.setAttribute('aria-invalid',String(Boolean(combined.partySize)));
    elements.childGroup.setAttribute('aria-invalid',String(Boolean(combined.childPresence || combined.under5ChildCount)));
    elements.childCount.setAttribute('aria-invalid',String(Boolean(combined.childCount)));
    elements.dietaryGroup.setAttribute('aria-invalid',String(Boolean(combined.dietarySelections || combined.dietaryRequirements)));
    allergyInput.setAttribute('aria-invalid',String(Boolean(combined.allergyDetail)));
    otherInput.setAttribute('aria-invalid',String(Boolean(combined.otherDetail)));
    elements.allergyDetail.setAttribute('aria-invalid',String(Boolean(combined.allergyDetail)));
    elements.otherDetail.setAttribute('aria-invalid',String(Boolean(combined.otherDetail)));
    elements.unableNote.setAttribute('aria-invalid',String(Boolean(combined.privateNote)));
    elements.announcement.textContent=combined.form || '';
  }

  function renderSuccess() {
    const copy=SUCCESS_COPY[rsvp.saved.status];
    elements.successDate.textContent=copy.date;show(elements.successDate,Boolean(copy.date));elements.successCopy.textContent=copy.copy;
  }

  function render() {
    const saved=rsvp?.phase==='saved';const saving=rsvp?.phase==='saving';
    show(elements.loading,!authorized);show(elements.form,authorized && !saved);show(elements.success,authorized && saved);show(elements.loadRetry,!authorized && !loading);
    if (!rsvp) return;
    elements.form.setAttribute('aria-busy',String(saving));
    for (const input of [...statusInputs,...childInputs,...dietaryInputs,elements.party,elements.childCount,elements.allergyDetail,elements.otherDetail,elements.unableNote]) input.disabled=saving || !authorized;
    const status=rsvp.draft.status;const attending=status==='attending';
    show(elements.selected,!saved && Boolean(status));show(elements.attending,!saved && attending);
    show(elements.childCountField,attending && childPresence==='yes');
    show(elements.allergyField,attending && dietarySelections.includes('allergy'));
    show(elements.otherField,attending && dietarySelections.includes('other'));
    show(elements.unableNoteField,!saved && status==='unable');
    allergyInput.setAttribute('aria-expanded',String(attending && dietarySelections.includes('allergy')));
    otherInput.setAttribute('aria-expanded',String(attending && dietarySelections.includes('other')));
    elements.stateMessage.textContent=status==='unsure'?'没关系，确定后再回来告诉我们。':status==='unable'?'没关系，心意收到。\n谢谢你告诉我们。':'';
    elements.partyHint.textContent=`这份邀请最多可回复 ${rsvp.saved.partyLimit} 人。`;
    elements.submit.disabled=saving || !authorized;elements.submit.textContent=saving?'正在确认…':'确认回复';
    if(saved)renderSuccess();renderErrors();
  }

  function focusFirstError() {
    if(uiErrors.status){statusInputs[0].focus();return;}if(uiErrors.partySize){elements.party.focus();return;}
    if(uiErrors.childPresence){childInputs[0].focus();return;}if(uiErrors.childCount){elements.childCount.focus();return;}
    if(uiErrors.dietarySelections){dietaryInputs[0].focus();return;}if(uiErrors.allergyDetail){elements.allergyDetail.focus();return;}
    if(uiErrors.otherDetail){elements.otherDetail.focus();return;}if(uiErrors.privateNote)elements.unableNote.focus();
  }

  function invalidate() {
    authEpoch+=1;authorized=false;rsvp=null;uiErrors={};elements.guestName.textContent='无法确认邀请';
    elements.loading.textContent='邀请链接可能无效、已停用或已过期。请联系 Louis & Joyce 确认。';elements.announcement.textContent='无法确认这份邀请。';
    show(elements.loading,true);show(elements.loadRetry,false);show(elements.form,false);show(elements.success,false);
  }

  async function loadInvitation() {
    if(loading)return;if(!/^[a-f0-9]{16,128}$/i.test(token)){invalidate();return;}
    loading=true;elements.loading.textContent='正在读取你的邀请…';render();const response=await api('invitation');loading=false;
    if(response.state==='invalid_invitation'){invalidate();return;}
    if(response.state!=='ready'){
      authorized=false;rsvp=null;elements.guestName.textContent='暂时无法读取';elements.loading.textContent='暂时无法读取邀请，请稍后重试。';elements.announcement.textContent='邀请资料尚未读取。';render();return;
    }
    authorized=true;elements.guestName.textContent=response.guest.displayName;rsvp=createRsvpState(response.rsvp);uiErrors={};syncUiFromDraft();render();
  }

  statusInputs.forEach(input=>input.addEventListener('change',()=>{
    if(!authorized||!rsvp)return;rsvp=changeRsvp(rsvp,'status',input.value);uiErrors={};render();
  }));
  elements.party.addEventListener('change',()=>{
    if(!rsvp)return;rsvp=changeRsvp(rsvp,'partySize',elements.party.value);replaceOptions(elements.childCount,1,Number(elements.party.value),elements.childCount.value);
    if(childPresence==='yes')rsvp=changeRsvp(rsvp,'under5ChildCount',elements.childCount.value);uiErrors={};render();
  });
  childInputs.forEach(input=>input.addEventListener('change',()=>{
    if(!rsvp)return;childPresence=input.value;rsvp=changeRsvp(rsvp,'under5ChildCount',childPresence==='no'?'0':elements.childCount.value||'1');uiErrors={};render();
  }));
  elements.childCount.addEventListener('change',()=>{
    if(!rsvp)return;rsvp=changeRsvp(rsvp,'under5ChildCount',elements.childCount.value);uiErrors={};render();
  });
  dietaryInputs.forEach(input=>input.addEventListener('change',()=>{
    if(!rsvp)return;const next=applyDietarySelection(dietarySelections,input.value,input.checked);dietarySelections=next.selections;
    if(next.clearDetails){allergyDetail='';otherDetail='';elements.allergyDetail.value='';elements.otherDetail.value='';}
    setChecks(dietarySelections);dietaryDirty=true;rsvp=syncDietaryDraft(rsvp,true,dietarySelections,{allergyDetail,otherDetail});uiErrors={};render();
  }));
  elements.allergyDetail.addEventListener('input',()=>{
    if(!rsvp)return;allergyDetail=elements.allergyDetail.value;dietaryDirty=true;rsvp=syncDietaryDraft(rsvp,true,dietarySelections,{allergyDetail,otherDetail});uiErrors={};render();
  });
  elements.otherDetail.addEventListener('input',()=>{
    if(!rsvp)return;otherDetail=elements.otherDetail.value;dietaryDirty=true;rsvp=syncDietaryDraft(rsvp,true,dietarySelections,{allergyDetail,otherDetail});uiErrors={};render();
  });
  elements.unableNote.addEventListener('input',()=>{
    if(!rsvp)return;rsvp=changeRsvp(rsvp,'privateNote',elements.unableNote.value);uiErrors={};render();
  });
  elements.form.addEventListener('submit',async event=>{
    event.preventDefault();if(!authorized||!rsvp)return;
    dietarySelections=checkedValues(dietaryInputs);allergyDetail=elements.allergyDetail.value;otherDetail=elements.otherDetail.value;
    uiErrors=page08Errors({status:rsvp.draft.status,partySize:elements.party.value,partyLimit:rsvp.saved.partyLimit,childPresence,childCount:elements.childCount.value,dietarySelections,allergyDetail,otherDetail});
    if(Object.keys(uiErrors).length){render();focusFirstError();return;}
    if(rsvp.draft.status==='attending')rsvp=syncDietaryDraft(rsvp,dietaryDirty,dietarySelections,{allergyDetail,otherDetail});
    const next=startSaving(rsvp);rsvp=next.state;render();
    if(!next.payload){elements.announcement.textContent='请检查填写内容后再确认。';elements.announcement.focus({preventScroll:true});return;}
    const epoch=authEpoch;const response=await api('rsvp',next.payload);if(epoch!==authEpoch)return;
    if(response.state==='invalid_invitation'){invalidate();return;}
    rsvp=finishSaving(rsvp,response);uiErrors={};render();
    if(rsvp.phase==='saved')elements.success.focus({preventScroll:true});else elements.announcement.focus({preventScroll:true});
  });
  elements.edit.addEventListener('click',()=>{
    if(!rsvp)return;rsvp=editRsvp(rsvp);uiErrors={};syncUiFromDraft();render();statusInputs.find(input=>input.checked)?.focus({preventScroll:true});
  });
  elements.loadRetry.addEventListener('click',loadInvitation);loadInvitation();
}

if (typeof document !== 'undefined') setupPage08();

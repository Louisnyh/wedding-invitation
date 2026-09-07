export function newRequestId() {
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2,'0')).join('');
}
export function createRsvpState(saved) {
  return {
    phase:saved.status ? 'saved' : 'editing', saved:{...saved},
    draft:{status:saved.status,partySize:String(saved.partySize ?? 1),dietaryRequirements:saved.dietaryRequirements,privateNote:saved.privateNote},
    errors:{},requestId:null,submitted:null
  };
}
export function changeRsvp(state, field, value) {
  if (state.phase === 'saving' || !['status','partySize','dietaryRequirements','privateNote'].includes(field)) return state;
  if (field === 'status' && !['attending','unsure','unable'].includes(value)) return state;
  return {...state,phase:field === 'status' ? 'selected' : 'editing',draft:{...state.draft,[field]:value},errors:{},requestId:null,submitted:null};
}
export function editRsvp(state) {
  if (state.phase === 'saving') return state;
  return {...createRsvpState(state.saved),phase:'editing'};
}
export function draftErrors(state) {
  const errors = {}; const draft = state.draft;
  if (!['attending','unsure','unable'].includes(draft.status)) errors.status = '请选择一个回复。';
  if (draft.status === 'attending' && (!/^[1-9]\d*$/.test(draft.partySize) || Number(draft.partySize) > state.saved.partyLimit)) errors.partySize = `请输入 1–${state.saved.partyLimit} 之间的整数。`;
  for (const key of ['dietaryRequirements','privateNote']) if (draft[key].length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(draft[key])) errors[key] = '请使用不超过 500 个字符的文字。';
  return errors;
}
export function startSaving(state, makeId = newRequestId) {
  if (state.phase === 'saving') return {state,payload:null};
  const errors = draftErrors(state);
  if (Object.keys(errors).length) return {state:{...state,phase:'recoverable_error',errors},payload:null};
  const payload = {
    status:state.draft.status,
    partySize:state.draft.status === 'attending' ? Number(state.draft.partySize) : null,
    dietaryRequirements:state.draft.status === 'attending' ? state.draft.dietaryRequirements : '',
    privateNote:state.draft.privateNote,
    requestId:state.requestId || makeId()
  };
  return {state:{...state,phase:'saving',requestId:payload.requestId,submitted:payload,errors:{}},payload};
}
export function finishSaving(state, response) {
  if (response.state === 'saved') return createRsvpState(response.rsvp);
  const errors = response.state === 'validation_error' ? Object.fromEntries(Object.keys(response.errors).map(key=>[key,'请检查此项后再次保存。'])) : {form:'暂时无法确认保存结果。填写内容已保留，请重试。'};
  return {...state,phase:'recoverable_error',errors};
}

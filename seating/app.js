import { API_URL } from '../release-v2-20261010-r8/js/config.js';
import { mountScratchCard } from './scratch-card.js';

const ERROR_STATES = new Set(['disabled','not_found','ambiguous','invalid_query','temporary_error','locked','invalid_invitation']);
const TOKEN_PATTERN = /^[a-f0-9]{16,128}$/i;

/** Pick public seating fields only, even when an invitation includes private RSVP fields. */
export function seatingResponse(value) {
  const unavailable = {schemaVersion:2,state:'temporary_error'};
  if (!value || value.schemaVersion !== 2 || typeof value.state !== 'string') return unavailable;
  if (ERROR_STATES.has(value.state)) return {schemaVersion:2,state:value.state};
  if (value.state !== 'ready' || typeof value.guest?.displayName !== 'string' || !value.guest.displayName.trim() || value.guest.displayName.length > 120) return unavailable;
  const table = value.tableCheck;
  if (!table || typeof table.state !== 'string') return unavailable;
  let tableCheck;
  if (table.state === 'available') {
    if (typeof table.assignment?.name !== 'string' || !table.assignment.name.trim() || table.assignment.name.length > 120) return unavailable;
    tableCheck = {state:'available',assignment:{name:table.assignment.name.trim()}};
  } else if (table.state === 'locked') {
    tableCheck = {state:'locked'};
    if (typeof table.releaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(table.releaseDate)) tableCheck.releaseDate = table.releaseDate;
  } else if (['assignment_pending','temporary_error'].includes(table.state)) {
    tableCheck = {state:table.state};
  } else return unavailable;
  return {schemaVersion:2,state:'ready',guest:{displayName:value.guest.displayName.trim()},tableCheck};
}

export function lookupNameError(value) {
  if (typeof value !== 'string' || !value.trim()) return '请先填写你的姓名。Please enter your name.';
  if (value.trim().length < 2) return '请填写完整姓名。Please use your full name.';
  if (value.trim().length > 120 || /[\u0000-\u001f\u007f*?%]/.test(value)) return '请填写完整姓名，不要加入特殊搜索符号。Please use your full name.';
  return '';
}

export async function requestSeating(payload, {url=API_URL,fetchImpl=globalThis.fetch,timeoutMs=15000} = {}) {
  if (!url) return {schemaVersion:2,state:'temporary_error'};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method:'POST', headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(payload), signal:controller.signal,
      credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'
    });
    if (!response.ok) throw new Error('Unavailable');
    const result = seatingResponse(await response.json());
    // Older invitation deployments do not yet recognize the public lookup.
    // Keep the shared entrance closed instead of asking guests to retry forever.
    if (payload.action === 'table_lookup' && result.state === 'invalid_invitation') return {schemaVersion:2,state:'disabled'};
    return result;
  } catch {
    return {schemaVersion:2,state:'temporary_error'};
  } finally { clearTimeout(timeout); }
}

const MESSAGES = {
  not_found:['还没找到这个名字','请试试 RSVP 时填写的完整姓名，或请现场接待人员帮你查找。','Try the full name on your RSVP, or ask our reception team.'],
  ambiguous:['请让我们帮你确认','有相同姓名的来宾。请找现场接待人员确认你的桌号。','Please ask our reception team to confirm your table.'],
  disabled:['座位查询尚未开放','你的位置正在安排中。到场后也可以请接待人员帮你查找。','Seat discovery will open closer to the celebration.'],
  locked:['座位查询尚未开放','你的位置正在安排中，请稍后再来看看。','Your seat is being prepared. Please check back later.'],
  assignment_pending:['你的位置正在安排中','我们已找到你的邀请，桌号还未公布。请稍后再试，或找现场接待人员。','We found your invitation. Your table is still being arranged.'],
  invalid_query:['请填写完整姓名','请使用 RSVP 时填写的姓名，再试一次。','Please try the full name on your RSVP.'],
  invalid_invitation:['请用姓名查找座位','这条邀请链接暂时无法读取。你可以返回，直接输入姓名查找。','You can go back and look up your seat by name.'],
  temporary_error:['暂时连接不上','请稍后再试。现场接待人员也可以帮你查找桌号。','Please try again shortly, or ask our reception team for your table.']
};

export function setupSeatingPage(doc = globalThis.document) {
  if (!doc?.getElementById('lookup-form')) return;
  const win = doc.defaultView || globalThis;
  const params = new URLSearchParams(win.location.search);
  const demo = params.get('demo') === '1';
  const hadToken = params.has('token');
  let token = params.get('token') || '';
  // Credentials never survive in history, links, storage, logs, or referrers.
  if (hadToken) {
    params.delete('token');
    const rest = params.toString();
    win.history.replaceState(win.history.state, '', `${win.location.pathname}${rest ? `?${rest}` : ''}${win.location.hash}`);
  }
  if (demo) token = '';
  const $ = id => doc.getElementById(id);
  const panels = ['welcome','loading','result','message'];
  const form = $('lookup-form');
  const input = $('guest-name');
  let card = null;
  let epoch = 0;

  function panel(name) { for (const id of panels) $(id).hidden = name !== id; }
  function message(state, releaseDate) {
    card?.destroy(); card = null;
    const copy = MESSAGES[state] || MESSAGES.temporary_error;
    $('message-title').textContent = copy[0];
    $('message-copy').textContent = copy[1] + (releaseDate ? ` 预计开放日期：${releaseDate}。` : '');
    $('message-english').textContent = copy[2];
    panel('message');
    $('message-title').focus({preventScroll:true});
  }
  function present(response) {
    if (response.state !== 'ready') { message(response.state); return; }
    const table = response.tableCheck;
    if (table.state !== 'available') { message(table.state, table.releaseDate); return; }
    $('result-name').textContent = response.guest.displayName;
    $('revealed-note').hidden = true;
    panel('result');
    card?.destroy();
    card = mountScratchCard($('scratch-host'), {
      tableName:table.assignment.name,
      guestName:response.guest.displayName,
      onReveal:() => { $('revealed-note').hidden = false; }
    });
    $('result-title').focus({preventScroll:true});
  }
  async function load(payload) {
    const thisEpoch = ++epoch;
    input.blur();
    panel('loading');
    const response = demo
      ? await Promise.resolve(['体验来宾','demo guest'].includes(String(payload.name || '').trim().toLowerCase())
        ? {schemaVersion:2,state:'ready',guest:{displayName:'体验来宾 · Demo Guest'},tableCheck:{state:'available',assignment:{name:'Table 08'}}}
        : {schemaVersion:2,state:'not_found'})
      : await requestSeating(payload);
    if (thisEpoch !== epoch) return;
    present(response);
  }
  function reset() {
    epoch++;
    card?.destroy(); card = null;
    $('form-error').hidden = true;
    input.removeAttribute('aria-invalid');
    panel('welcome');
    input.focus({preventScroll:true});
    input.select();
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const error = lookupNameError(input.value);
    if (error) {
      $('form-error').textContent = error;
      $('form-error').hidden = false;
      input.setAttribute('aria-invalid','true');
      input.focus();
      return;
    }
    $('form-error').hidden = true;
    input.removeAttribute('aria-invalid');
    load({action:'table_lookup',name:input.value.trim()});
  });
  input.addEventListener('input', () => {
    if (!$('form-error').hidden) { $('form-error').hidden = true; input.removeAttribute('aria-invalid'); }
  });
  $('another-guest').addEventListener('click', reset);
  $('message-back').addEventListener('click', reset);
  if (demo) {
    $('demo-banner').hidden = false;
    $('demo-hint').hidden = false;
    input.value = '体验来宾';
    doc.title = '体验 Find Your Seat · Louis & Joyce';
  } else if (hadToken) {
    if (TOKEN_PATTERN.test(token)) load({action:'invitation',token});
    else message('invalid_invitation');
    token = '';
  }
}

if (typeof document !== 'undefined') setupSeatingPage();

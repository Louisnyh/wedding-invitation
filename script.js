import { API_URL } from './js/config.js';
import { createApi } from './js/api.js';
import { safeMapUrl } from './js/schema.js';
import { createRsvpState, changeRsvp, editRsvp, startSaving, finishSaving } from './js/rsvp-state.js';
import { renderTableCheck } from './js/table-check.js';

const $ = selector => document.querySelector(selector);
const show = (element, visible) => { element.hidden = !visible; element.style.display = visible ? '' : 'none'; };
const token = new URLSearchParams(location.search).get('token') || '';
const api = createApi({url:API_URL, token});
const options = [...document.querySelectorAll('[data-rsvp]')];
const fields = {partySize:$('#guest-count'),dietaryRequirements:$('#dietary'),privateNote:$('#private-note')};
let rsvp = null;
let authorized = false;
let authEpoch = 0;
let loading = false;

function renderEvent(event) {
  if (event.dateLabel) $('.hero-date').textContent = event.dateLabel;
  const rows = [
    ['日期',event.dateLabel,'请把这一天留给我们。'],
    ['时间',event.timeLabel,'建议预留一些时间抵达、入座和慢慢见面。'],
    ['地点',event.venueName,event.venueAddress],
    ['着装',event.dressCode,'舒服、得体，也适合晚间户外活动即可。']
  ];
  const fragment = document.createDocumentFragment();
  rows.forEach(([label,value,note],index) => {
    const item = document.createElement('article'); item.className = 'detail-item';
    for (const [tag,copy] of [['span',label],['strong',value],['p',note]]) {
      const element = document.createElement(tag); element.textContent = copy; item.append(element);
    }
    if (index === 2) {
      const links = document.createElement('div'); links.className = 'venue-links';
      for (const [name,kind,url,icon] of [['Google Maps','maps',event.googleMapsUrl,'assets/google-maps.png'],['Waze','waze',event.wazeUrl,'assets/waze.png']]) {
        const safe = safeMapUrl(url,kind); if (!safe) continue;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'map-button';
        const image = document.createElement('img'); image.src = icon; image.alt = '';
        const label = document.createElement('span'); label.textContent = name;
        button.append(image,label); button.addEventListener('click',()=>window.open(safe,'_blank','noopener,noreferrer')); links.append(button);
      }
      item.append(links);
    }
    fragment.append(item);
  });
  $('#details-grid').replaceChildren(fragment);
}

function renderRsvp() {
  if (!rsvp) {
    options.forEach(button=>{button.disabled=true;button.classList.remove('is-selected');button.setAttribute('aria-pressed','false');});
    show($('#rsvp-editor'),false); show($('#edit-rsvp'),false); return;
  }
  const saved = rsvp.phase === 'saved';
  const saving = rsvp.phase === 'saving';
  $('.rsvp-panel').dataset.state = rsvp.phase;
  $('.rsvp-panel').setAttribute('aria-busy',String(saving));
  show($('.rsvp-options'),!saved);
  options.forEach(button=>{
    button.disabled = !authorized || saving;
    button.classList.toggle('is-selected',button.dataset.rsvp === rsvp.draft.status);
    button.setAttribute('aria-pressed',String(button.dataset.rsvp === rsvp.draft.status));
  });
  show($('#rsvp-editor'),!saved && Boolean(rsvp.draft.status));
  show($('#edit-rsvp'),saved);
  const attending = rsvp.draft.status === 'attending';
  show($('#party-field'),attending); show($('#dietary-field'),attending);
  for (const [key,input] of Object.entries(fields)) {
    if (input.value !== rsvp.draft[key]) input.value = rsvp.draft[key];
    input.disabled = saving || !authorized;
    input.setAttribute('aria-invalid',String(Boolean(rsvp.errors[key])));
  }
  $('#party-hint').textContent = `此邀请最多可回复 ${rsvp.saved.partyLimit} 人。`;
  $('#rsvp-save').disabled = saving || !authorized;
  $('#rsvp-save').textContent = saving ? '正在保存…' : '保存出席回复';
  const copy = {attending:'你已经确认出席。我们很期待十二月见到你。',unsure:'我们已经收到你暂时不确定的回复。',unable:'我们已经收到你无法出席的回复。谢谢你告诉我们。'};
  $('#rsvp-status').textContent = saved ? copy[rsvp.saved.status] : saving ? '正在保存你的回复。' : Object.keys(rsvp.errors).length ? Object.values(rsvp.errors).join(' ') : rsvp.draft.status ? '选择尚未保存。请填写后点击保存出席回复。' : '请选择一个回复，我们会为你安排后续细节。';
}

function invalidate() {
  authEpoch += 1; authorized = false; rsvp = null;
  for (const input of Object.values(fields)) input.value = '';
  $('#personal-title').textContent = '我们暂时无法找到这份专属邀请。';
  $('#personal-message').textContent = '邀请链接可能无效、已停用或已过期。请联系 Louis & Joyce 确认。';
  $('#rsvp-title').textContent = '请使用有效的专属邀请回复出席。';
  $('#rsvp-status').textContent = '无法确认这份邀请。';
  show($('#invitation-retry'),false); renderRsvp(); renderTableCheck({state:'invalid_invitation'});
}

async function loadInvitation(tableOnly = false) {
  if (loading) return;
  if (!/^[a-f0-9]{16,128}$/i.test(token)) { invalidate(); return; }
  loading = true;
  show($('#invitation-retry'),false);
  renderTableCheck({state:'loading'});
  const response = await api('invitation');
  loading = false;
  if (response.state === 'invalid_invitation') { invalidate(); return; }
  if (response.state !== 'ready') {
    renderTableCheck({state:'temporary_error'});
    if (!tableOnly || !authorized) {
      $('#personal-title').textContent = '暂时无法读取邀请。';
      $('#personal-message').textContent = '请稍后重试，或联系 Louis & Joyce。';
      $('#rsvp-status').textContent = '邀请资料尚未读取，请先重试。';
      show($('#invitation-retry'),true);
    }
    return;
  }
  renderTableCheck(response.tableCheck);
  if (tableOnly && authorized) return; // A Table Check refresh must never overwrite an RSVP draft.
  authorized = true;
  $('#personal-title').textContent = `${response.guest.displayName}，我们为你准备了这份邀请。`;
  $('#personal-message').textContent = '感谢你成为这一天重要的一部分。我们期待在晚风和暖灯里与你相见。';
  $('#rsvp-title').textContent = `${response.guest.displayName}，12月5日，可以把这个晚上留给我们吗？`;
  renderEvent(response.event);
  rsvp = createRsvpState(response.rsvp); renderRsvp();
}

options.forEach(button=>button.addEventListener('click',()=>{
  if (!authorized || !rsvp) return;
  rsvp = changeRsvp(rsvp,'status',button.dataset.rsvp); renderRsvp();
}));
for (const [key,input] of Object.entries(fields)) input.addEventListener('input',()=>{
  if (!rsvp) return;
  rsvp = changeRsvp(rsvp,key,input.value); renderRsvp();
});
$('#edit-rsvp').addEventListener('click',()=>{if(rsvp){rsvp=editRsvp(rsvp);renderRsvp();options[0].focus();}});
$('#rsvp-form').addEventListener('submit',async event=>{
  event.preventDefault(); if (!authorized || !rsvp) return;
  const next = startSaving(rsvp); rsvp = next.state; renderRsvp();
  if (!next.payload) { $('#rsvp-status').focus(); return; }
  const epoch = authEpoch;
  const response = await api('rsvp',next.payload);
  if (epoch !== authEpoch) return;
  if (response.state === 'invalid_invitation') {invalidate();$('#rsvp-status').focus();return;}
  rsvp = finishSaving(rsvp,response); renderRsvp(); $('#rsvp-status').focus();
});
$('#invitation-retry').addEventListener('click',()=>loadInvitation());
$('#table-check-button').addEventListener('click',()=>loadInvitation(true));

// Keep the existing visual treatment. No new photograph, palette or section order.
function setupReveal() {
  const items = document.querySelectorAll('.scene-reveal');
  if (!('IntersectionObserver' in window)) {items.forEach(item=>item.classList.add('is-visible'));return;}
  const observer = new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
  }),{threshold:0.18});
  items.forEach(item=>observer.observe(item));
}
function setupCountdown() {
  const target = new Date($('#wedding-countdown').dataset.target).getTime();
  let timer;
  const update = () => {
    const remaining = Math.max(0,Math.floor((target-Date.now())/1000));
    const values = [Math.floor(remaining/86400),Math.floor(remaining%86400/3600),Math.floor(remaining%3600/60),remaining%60];
    ['days','hours','minutes','seconds'].forEach((part,index)=>{$(`#countdown-${part}`).textContent=String(values[index]).padStart(index?2:1,'0');});
    if (!remaining && timer) clearInterval(timer);
  };
  update(); timer=setInterval(update,1000);
}
setupReveal(); setupCountdown(); renderRsvp(); loadInvitation();

const fail = () => { throw new Error('Invalid API response'); };
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const actual = Object.keys(value).sort();
  if (actual.join('|') !== [...expected].sort().join('|')) fail();
}
function text(value, max) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail();
}
export function safeMapUrl(value, kind) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048 || /[\s<>"'\\\u0000-\u001f]/.test(value)) return '';
  try {
    const url = new URL(value);
    const hosts = kind === 'waze' ? ['ul.waze.com', 'waze.com', 'www.waze.com'] : ['maps.app.goo.gl', 'maps.google.com', 'google.com', 'www.google.com', 'www.google.com.my'];
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) return '';
    if (kind !== 'waze' && !['maps.app.goo.gl', 'maps.google.com'].includes(url.hostname) && !/^\/maps(?:\/|$)/.test(url.pathname)) return '';
    return value;
  } catch { return ''; }
}
export function validateRsvp(value) {
  keys(value, ['status','partySize','partyLimit','under5ChildCount','dietaryRequirements','privateNote']);
  if (![null,'attending','unsure','unable'].includes(value.status)) fail();
  if (!Number.isInteger(value.partyLimit) || value.partyLimit < 1 || value.partyLimit > 20) fail();
  if (value.partySize !== null && (!Number.isInteger(value.partySize) || value.partySize < 1 || value.partySize > 20)) fail();
  if (value.under5ChildCount !== null && (!Number.isInteger(value.under5ChildCount) || value.under5ChildCount < 0 || value.under5ChildCount > 20)) fail();
  if (value.status === 'attending' && value.under5ChildCount !== null && (value.partySize === null || value.under5ChildCount > value.partySize)) fail();
  if (value.status !== 'attending' && (value.partySize !== null || value.under5ChildCount !== null || value.dietaryRequirements !== '')) fail();
  text(value.dietaryRequirements,500); text(value.privateNote,500);
  return value;
}
export function validateTable(value) {
  if (!value || typeof value !== 'object') fail();
  if (value.state === 'locked') {
    keys(value,['state','reason','releaseDate']);
    if (!['scheduled','force_closed'].includes(value.reason)) fail();
    if (value.reason === 'force_closed' ? value.releaseDate !== null : !/^\d{4}-\d{2}-\d{2}$/.test(value.releaseDate)) fail();
  } else if (value.state === 'available') {
    keys(value,['state','assignment']); keys(value.assignment,['name']); text(value.assignment.name,120);
    if (!value.assignment.name) fail();
  } else if (['assignment_pending','temporary_error'].includes(value.state)) keys(value,['state']);
  else fail();
  return value;
}
export function validateResponse(value) {
  if (!value || value.schemaVersion !== 2) fail();
  if (['temporary_error','invalid_invitation'].includes(value.state)) keys(value,['schemaVersion','state']);
  else if (value.state === 'validation_error') {
    keys(value,['schemaVersion','state','errors']);
    if (!value.errors || typeof value.errors !== 'object' || Array.isArray(value.errors)) fail();
    for (const [key,message] of Object.entries(value.errors)) {
      if (!['form','status','partySize','under5ChildCount','dietaryRequirements','privateNote'].includes(key)) fail();
      text(message,200);
    }
  } else if (value.state === 'saved') {
    keys(value,['schemaVersion','state','rsvp']); validateRsvp(value.rsvp);
  } else if (value.state === 'ready') {
    keys(value,['schemaVersion','state','guest','event','rsvp','tableCheck']);
    keys(value.guest,['displayName']); text(value.guest.displayName,120);
    keys(value.event,['dateLabel','timeLabel','venueName','venueAddress','dressCode','googleMapsUrl','wazeUrl']);
    for (const [key,max] of Object.entries({dateLabel:100,timeLabel:100,venueName:160,venueAddress:300,dressCode:160})) text(value.event[key],max);
    for (const [key,kind] of [['googleMapsUrl','maps'],['wazeUrl','waze']]) {
      text(value.event[key],2048);
      if (value.event[key] && !safeMapUrl(value.event[key],kind)) fail();
    }
    validateRsvp(value.rsvp); validateTable(value.tableCheck);
  } else fail();
  return value;
}

import { WEDDING_CONTENT } from './wedding-content.js';

const {event, venue, schedule} = WEDDING_CONTENT;

const fieldValues = {
  'event.dateDisplay': event.dateDisplay,
  'event.dayLabel': event.dayLabel,
  'schedule.receptionTime': schedule.receptionTime,
  'schedule.dinnerTime': schedule.dinnerTime,
  'venue.dressCode': venue.dressCode
};

function timeToISO(display) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(display);
  if (!match) return '';
  let hour = Number(match[1]) % 12;
  if (match[3] === 'PM') hour += 12;
  return `${event.dateISO}T${String(hour).padStart(2, '0')}:${match[2]}:00${event.timezone}`;
}

for (const element of document.querySelectorAll('[data-wedding-field]')) {
  const value = fieldValues[element.dataset.weddingField];
  if (typeof value === 'string') element.textContent = value;
}

for (const element of document.querySelectorAll('[data-wedding-date]')) {
  element.dateTime = event.dateISO;
}

for (const element of document.querySelectorAll('[data-wedding-time]')) {
  const value = fieldValues[element.dataset.weddingTime];
  element.dateTime = timeToISO(value);
}

const venueName = document.querySelector('[data-wedding-field="venue.venueName"]');
if (venueName) {
  const parts = /^(.*? · )(\S+\s+\S+)(.*)$/.exec(venue.venueName);
  if (!parts) venueName.textContent = venue.venueName;
  else {
    const protectedName = document.createElement('span');
    protectedName.className = 'ceremony__venue-nowrap';
    protectedName.textContent = parts[2];
    venueName.replaceChildren(parts[1], protectedName, parts[3]);
  }
}

const mapLink = document.querySelector('[data-wedding-map]');
if (mapLink) {
  mapLink.href = venue.googleMapsUrl;
  mapLink.setAttribute('aria-label', `Open ${venue.venueName} in Google Maps (opens in a new tab)`);
}

const timelineEntries = [...document.querySelectorAll('[data-wedding-timeline]')];
timelineEntries.forEach((entry, index) => {
  const item = schedule.timeline[index];
  if (!item) return;
  entry.querySelector('time').textContent = item.time;
  entry.querySelector('h3').textContent = item.title;
});

document.title = `Louis Ng & Joyce Phoon · ${event.dateDisplay}`;

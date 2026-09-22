const dateISO = '2027-01-23';
const timezone = '+08:00';
const receptionTime = '5:30 PM';
const ceremonyTime = '6:00 PM';
const dinnerTime = '7:15 PM';
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function timeTo24Hour(display) {
  const [, hourText, minute, period] = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(display);
  let hour = Number(hourText) % 12;
  if (period === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function formatShareDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${monthNames[month - 1]} ${year}`;
}

const content = {
  event: {
    dateDisplay: '23 · 1 · 2027',
    dateISO,
    dayLabel: 'Saturday',
    timezone,
    countdownTarget: `${dateISO}T${timeTo24Hour(receptionTime)}:00${timezone}`
  },
  venue: {
    venueName: '億家主题宴会厅 · Hall E 露天草坪',
    venueAddress: '',
    dressCode: 'Smart Casual',
    googleMapsUrl: 'https://maps.app.goo.gl/tDacdw6Jo4zL5B4U6',
    wazeUrl: ''
  },
  schedule: {
    receptionTime,
    ceremonyTime,
    dinnerTime,
    timeline: [
      {time: `${ceremonyTime.replace(/ (?:AM|PM)$/, '')} - ${dinnerTime}`, title: 'The Ceremony'},
      {time: dinnerTime, title: 'Dinner Begins'},
      {time: '8:15 PM', title: 'Celebrate With Us'},
      {time: '9:00 - 10:00 PM', title: 'Stay A Little Longer'}
    ]
  },
  share: {
    title: 'Louis & Joyce · Wedding Invitation',
    description: `We're getting married · ${formatShareDate(dateISO)}`,
    canonicalUrl: 'https://louisnyh.github.io/wedding-invitation/',
    imageAlt: 'Louis and Joyce walking together by the sea at sunset on their wedding invitation cover.',
    ogImageAsset: 'assets/social/wedding-share-2027-og.jpg'
  }
};

function deepFreeze(value) {
  Object.values(value).forEach(item => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) deepFreeze(item);
  });
  return Object.freeze(value);
}

export const WEDDING_CONTENT = deepFreeze(content);

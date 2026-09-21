import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {WEDDING_CONTENT} from '../frontend-v2/scripts/wedding-content.js';
import {SUCCESS_COPY} from '../frontend-v2/scripts/rsvp-adapter.js';

const sourceRoot = new URL('../frontend-v2/', import.meta.url);
const readSource = path => readFile(new URL(path, sourceRoot), 'utf8');

test('canonical wedding date and timezone are the approved 2027 values', () => {
  assert.deepEqual(WEDDING_CONTENT.event, {
    dateDisplay: '23 · 1 · 2027',
    dateISO: '2027-01-23',
    dayLabel: 'Saturday',
    timezone: '+08:00',
    countdownTarget: '2027-01-23T17:30:00+08:00'
  });
});

test('canonical reception, ceremony and dinner times are approved', () => {
  assert.equal(WEDDING_CONTENT.schedule.receptionTime, '5:30 PM');
  assert.equal(WEDDING_CONTENT.schedule.ceremonyTime, '6:00 PM');
  assert.equal(WEDDING_CONTENT.schedule.dinnerTime, '7:15 PM');
});

test('canonical venue content retains the approved values without invented links', () => {
  assert.equal(WEDDING_CONTENT.venue.venueName, '億家主题宴会厅 · Hall E 露天草坪');
  assert.equal(WEDDING_CONTENT.venue.dressCode, 'Smart Casual');
  assert.equal(WEDDING_CONTENT.venue.googleMapsUrl, 'https://maps.app.goo.gl/tDacdw6Jo4zL5B4U6');
  assert.equal(WEDDING_CONTENT.venue.venueAddress, '');
  assert.equal(WEDDING_CONTENT.venue.wazeUrl, '');
});

test('Page 06 has exactly the four approved canonical timeline entries', () => {
  assert.deepEqual(WEDDING_CONTENT.schedule.timeline, [
    {time: '6:00 - 7:15 PM', title: 'The Ceremony'},
    {time: '7:15 PM', title: 'Dinner Begins'},
    {time: '8:15 PM', title: 'Celebrate With Us'},
    {time: '9:00 - 10:00 PM', title: 'Stay A Little Longer'}
  ]);
});

test('Page 08 attending success uses the canonical wedding date', () => {
  assert.equal(SUCCESS_COPY.attending.date, WEDDING_CONTENT.event.dateDisplay);
  assert.equal(SUCCESS_COPY.attending.copy, '那天见。');
  assert.equal(SUCCESS_COPY.unsure.date, '');
  assert.equal(SUCCESS_COPY.unable.date, '');
});

test('Pages 01, 02 and 05 bind their dates instead of keeping independent copies', async () => {
  const html = await readSource('index.html');
  assert.equal((html.match(/data-wedding-field="event\.dateDisplay"/g) || []).length, 3);
  assert.match(html, /opening__date[\s\S]*data-wedding-field="event\.dateDisplay"/);
  assert.match(html, /story__date[\s\S]*data-wedding-field="event\.dateDisplay"/);
  assert.match(html, /ceremony__date-display[\s\S]*data-wedding-field="event\.dateDisplay"/);
  assert.doesNotMatch(html, /23 · 1 · 2027|05 · 12 · 2026/);
});

test('Page 01 countdown imports the canonical target', async () => {
  const countdown = await readSource('scripts/countdown.js');
  assert.match(countdown, /WEDDING_CONTENT\.event\.countdownTarget/);
  assert.doesNotMatch(countdown, /2026-12-05|2027-01-23T17:30:00\+08:00/);
});

test('Page 05 and Page 06 render all mutable event content from the canonical module', async () => {
  const html = await readSource('index.html');
  const renderer = await readSource('scripts/wedding-content-renderer.js');
  for (const field of ['schedule.receptionTime','schedule.dinnerTime','venue.venueName','venue.dressCode']) {
    assert.ok(html.includes(`data-wedding-field="${field}"`));
  }
  assert.equal((html.match(/data-wedding-timeline/g) || []).length, 4);
  assert.match(renderer, /schedule\.timeline\[index\]/);
  assert.match(renderer, /mapLink\.href = venue\.googleMapsUrl/);
});

test('old mutable wedding values do not remain in active frontend-v2 source', async () => {
  const files = (await readdir(sourceRoot, {recursive:true,withFileTypes:true}))
    .filter(item => item.isFile() && /\.(?:html|js|css)$/.test(item.name));
  const source = (await Promise.all(files.map(item => readFile(`${item.parentPath}/${item.name}`, 'utf8')))).join('\n');
  for (const stale of [
    /05 · 12 · 2026/,
    /2026-12-05/,
    /6:00–7:00 PM/,
    /7:00–8:00 PM/,
    /8:00–9:00 PM/,
    /9:00–10:00 PM/
  ]) assert.doesNotMatch(source, stale);
  assert.notEqual(WEDDING_CONTENT.schedule.receptionTime, '6:00 PM');
  assert.notEqual(WEDDING_CONTENT.schedule.dinnerTime, '7:00 PM');
});

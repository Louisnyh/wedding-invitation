import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WEDDING_CONTENT} from '../frontend-v2/scripts/wedding-content.js';
import {SUCCESS_COPY} from '../frontend-v2/scripts/rsvp-adapter.js';

const html=await readFile(new URL('../frontend-v2/index.html',import.meta.url),'utf8');
const renderer=await readFile(new URL('../frontend-v2/scripts/wedding-content-renderer.js',import.meta.url),'utf8');
const page02=html.slice(html.indexOf('<section class="story"'),html.indexOf('</section>',html.indexOf('<section class="story"')));
const page05=html.slice(html.indexOf('<section class="ceremony"'),html.indexOf('</section>',html.indexOf('<section class="ceremony"')));
const page08=html.slice(html.indexOf('<section class="rsvp"'));

test('Page 02 keeps every approved Chinese paragraph unchanged',()=>{
  for(const copy of ['我们都不是特别喜欢热闹的人。','但结婚这件事，刚好给了我们一个理由，','把平时各自忙碌的大家聚在一起。','希望这一天，你可以轻松地来，开心地吃，','也陪我们一起见证这段故事走到新的开始。']) assert.ok(page02.includes(copy));
});

test('Page 02 places all three approved English translations with the Chinese copy',()=>{
  for(const copy of [
    'Neither of us has ever been particularly drawn to big, lively crowds.',
    'But getting married gave us the perfect reason',
    "to bring together the people we care about, even in the middle of everyone's busy lives.",
    'We hope you can simply come, relax, enjoy the food,',
    'and be there with us as our story begins a new chapter.'
  ]) assert.ok(page02.includes(copy));
  assert.equal((page02.match(/class="story__paragraph"/g)||[]).length,3);
});

test('Page 05 English venue name is canonical content rendered beneath the Chinese venue',()=>{
  assert.equal(WEDDING_CONTENT.venue.venueName,'億家主题宴会厅 · Hall E 露天草坪');
  assert.equal(WEDDING_CONTENT.venue.venueNameEn,'YIJIA Theme Banquet');
  assert.match(page05,/venue\.venueName"[\s\S]*venue\.venueNameEn/);
  assert.match(renderer,/'venue\.venueNameEn': venue\.venueNameEn/);
});

test('Page 08 title and approved Chinese opening remain unchanged',()=>{
  assert.match(page08,/Will You Join Us\?/);
  assert.match(page08,/如果你愿意把这一天留给我们，[\s\S]*我们会很开心见到你。/);
  assert.match(page08,/告诉我们，你会不会来吧。/);
});

test('Page 08 English opening is present directly after its Chinese copy',()=>{
  assert.match(page08,/如果你愿意把这一天留给我们，[\s\S]*If you can save this day for us,[\s\S]*we'd be so happy to celebrate it with you\./);
  assert.match(page08,/告诉我们，你会不会来吧。[\s\S]*Let us know if you'll be joining us\./);
});

test('all essential Page 08 controls contain their approved English equivalents',()=>{
  for(const copy of ['Your Name','Please choose your response',"I'll be there","I'm not sure yet","Sorry, I won't be able to make it",'Number of Guests','Will any children under 5 be joining you?','Yes','No','Number of Children Under 5','Any Dietary Requirements?','Vegetarian','Food Sensitivities or Allergies','Other','None','Please tell us what we should be aware of','Please tell us about any other dietary needs','Would you like to leave us a note? (Optional)','Submit RSVP','Edit Response']) assert.ok(page08.includes(copy),copy);
});

test('General name field is required-capable, Unicode-safe, and bounded without a token field',()=>{
  assert.match(page08,/id="rsvp-guest-name-input"[^>]+maxlength="120"[^>]+autocomplete="name"/);
  assert.match(page08,/placeholder="请输入你的姓名"/);
  assert.doesNotMatch(page08,/name="token"/);
});

test('all three RSVP success states preserve Chinese and add English',()=>{
  assert.match(SUCCESS_COPY.attending.copy,/那天见。\nSee you there\./);
  assert.match(SUCCESS_COPY.unsure.copy,/确定以后，再回来告诉我们就好。\nCome back and let us know/);
  assert.match(SUCCESS_COPY.unable.copy,/虽然这次没机会和你一起庆祝，希望之后还能找个时间一起吃个饭。\nWe’ll miss you/);
  assert.match(page08,/谢谢你的回复。[\s\S]*Thank you for your response\./);
});

test('General success offers an in-memory-only personal link copy action',()=>{
  assert.match(page08,/保存你的专属邀请链接[\s\S]*Save your personal invitation link[\s\S]*Copy Link/);
  assert.doesNotMatch(page08,/localStorage|sessionStorage/);
});

test('canonical wedding date remains data-bound rather than duplicated in bilingual markup',()=>{
  assert.equal(WEDDING_CONTENT.event.dateDisplay,'23 · 1 · 2027');
  assert.equal((html.match(/data-wedding-field="event\.dateDisplay"/g)||[]).length,3);
  assert.doesNotMatch(html,/23 · 1 · 2027/);
});

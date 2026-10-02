import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const releaseRoot=new URL('../release-v2-20261002-r6/',import.meta.url);
const sourceRoot=new URL('../',import.meta.url);

test('r6 immutable candidate contains the General and bilingual frontend',async()=>{
  const html=await readFile(new URL('frontend-v2/index.html',releaseRoot),'utf8');
  const content=await readFile(new URL('frontend-v2/scripts/wedding-content.js',releaseRoot),'utf8');
  assert.match(html,/rsvp-guest-name-input/);
  assert.match(html,/Neither of us has ever been particularly drawn/);
  assert.match(content,/venueNameEn: 'YIJIA Theme Banquet'/);
  assert.match(html,/Please choose your response/);
});

test('r6 candidate uses an explicit Apps Script endpoint without a guest credential',async()=>{
  const config=await readFile(new URL('js/config.js',releaseRoot),'utf8');
  assert.match(config,/API_URL = "https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec"/);
  assert.match(config,/PREVIEW_TOKEN = ""/);
  assert.doesNotMatch(config,/\?token=|invite=general/);
});

test('r6 keeps approved Open Graph metadata and image namespace unchanged',async()=>{
  const html=await readFile(new URL('frontend-v2/index.html',releaseRoot),'utf8');
  assert.equal([...html.matchAll(/<meta property="og:image" /g)].length,1);
  assert.match(html,/release-v2-20260922-r3\/assets\/social\/wedding-share-2027-og\.jpg/);
  assert.match(html,/<meta property="og:title" content="Louis &amp; Joyce · Wedding Invitation" \/>/);
});

test('r6 executable frontend files match the prepared source candidate',async()=>{
  for(const path of ['frontend-v2/scripts/rsvp-adapter.js','frontend-v2/scripts/wedding-content.js','frontend-v2/styles/page-02.css','frontend-v2/styles/page-05.css','frontend-v2/styles/page-08.css','js/api.js','js/schema.js','js/rsvp-state.js']){
    assert.deepEqual(await readFile(new URL(path,releaseRoot)),await readFile(new URL(path,sourceRoot)),path);
  }
});

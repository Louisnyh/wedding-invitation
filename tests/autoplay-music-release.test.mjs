import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const releaseRoot=new URL('../release-v2-20261010-r8/',import.meta.url);

test('r8 uses one explicit initialization play attempt without an autoplay attribute',async()=>{
  const html=await readFile(new URL('frontend-v2/index.html',releaseRoot),'utf8');
  const music=await readFile(new URL('frontend-v2/scripts/wedding-music.js',releaseRoot),'utf8');
  assert.doesNotMatch(html.match(/<audio[\s\S]*?>/)[0],/\bautoplay\b/);
  assert.match(music,/const initialAttempt = attemptPlay\(\)/);
  assert.doesNotMatch(music,/setTimeout|requestAnimationFrame|IntersectionObserver/);
});

test('r8 contains the three-attempt swipe fallback and manual decision lock',async()=>{
  const music=await readFile(new URL('frontend-v2/scripts/wedding-music.js',releaseRoot),'utf8');
  assert.match(music,/WEDDING_MUSIC_MAX_SWIPE_ATTEMPTS = 3/);
  assert.match(music,/swipeAttempts \+= 1/);
  assert.match(music,/swipeAttempts >= WEDDING_MUSIC_MAX_SWIPE_ATTEMPTS/);
  assert.match(music,/explicitDecision = true/);
  assert.doesNotMatch(music,/whatsapp|telegram|messenger|userAgent|document\.referrer/i);
});

test('r8 music executable matches source and all other release files match r7',async()=>{
  const source=await readFile(new URL('../frontend-v2/scripts/wedding-music.js',import.meta.url),'utf8');
  const release=await readFile(new URL('frontend-v2/scripts/wedding-music.js',releaseRoot),'utf8');
  assert.equal(release,source);
  const result=spawnSync('diff',['-qr','release-v2-20261010-r7','release-v2-20261010-r8'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,1);
  const differences=result.stdout;
  assert.match(differences,/frontend-v2\/scripts\/wedding-music\.js/);
  assert.equal(differences.trim().split('\n').length,1);
});

test('r8 preserves the approved endpoint and contains no guest credential',async()=>{
  const config=await readFile(new URL('js/config.js',releaseRoot),'utf8');
  assert.match(config,/API_URL = "https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec"/);
  assert.match(config,/PREVIEW_TOKEN = ""/);
  assert.doesNotMatch(config,/[?&]token=|[a-f0-9]{64}/);
});

test('public root serves the approved r8 release',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<base href="\.\/release-v2-20261010-r8\/frontend-v2\/" \/>/);
  assert.doesNotMatch(html,/<base href="\.\/release-v2-20261010-r7\/frontend-v2\/" \/>/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const sourceRoot=new URL('../',import.meta.url);
const releaseRoot=new URL('../release-v2-20261010-r7/',import.meta.url);

test('r7 contains the semantic Page 02 spacing fix',async()=>{
  const html=await readFile(new URL('frontend-v2/index.html',releaseRoot),'utf8');
  const page02=html.slice(html.indexOf('<section class="story"'),html.indexOf('</section>',html.indexOf('<section class="story"')));
  const text=page02.replace(/<br\s*\/?>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  assert.match(text,/perfect reason to bring together/);
  assert.doesNotMatch(text,/perfect reasonto bring together/);
  assert.match(text,/the food, and be there with us/);
});

test('r7 contains the source-independent one-shot swipe implementation',async()=>{
  const music=await readFile(new URL('frontend-v2/scripts/wedding-music.js',releaseRoot),'utf8');
  assert.match(music,/touchIdentifier/);
  assert.match(music,/audio\.play\(\)/);
  assert.match(music,/passive:true,capture:true/);
  assert.doesNotMatch(music,/whatsapp|telegram|messenger|userAgent|document\.referrer/i);
});

test('r7 preserves the approved endpoint without embedding a guest credential',async()=>{
  const config=await readFile(new URL('js/config.js',releaseRoot),'utf8');
  assert.match(config,/API_URL = "https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec"/);
  assert.match(config,/PREVIEW_TOKEN = ""/);
  assert.doesNotMatch(config,/[?&]token=|[a-f0-9]{64}/);
});

test('r7 remains immutable after the next music refinement',async()=>{
  const release=await readFile(new URL('frontend-v2/index.html',releaseRoot),'utf8');
  const source=await readFile(new URL('frontend-v2/index.html',sourceRoot),'utf8');
  const body=value=>value.slice(value.indexOf('<body>'));
  assert.equal(body(release),body(source),'frontend-v2/index.html');
  assert.doesNotThrow(()=>execFileSync('git',['diff','--quiet','origin/main','--','release-v2-20261010-r7'],{cwd:root}));
  assert.doesNotThrow(()=>execFileSync('git',['diff','--quiet','origin/main','--','release-v2-20261002-r6'],{cwd:root}));
});

test('public root serves the approved r7 release',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<base href="\.\/release-v2-20261010-r7\/frontend-v2\/" \/>/);
  assert.doesNotMatch(html,/<base href="\.\/release-v2-20261002-r6\/frontend-v2\/" \/>/);
});

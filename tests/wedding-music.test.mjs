import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import {openingFiles,renderShareMetadata} from '../scripts/build.mjs';
import {initWeddingMusic,WEDDING_MUSIC_SWIPE_THRESHOLD,WEDDING_MUSIC_VOLUME} from '../frontend-v2/scripts/wedding-music.js';

const root = new URL('../',import.meta.url);
const html = await readFile(new URL('../frontend-v2/index.html',import.meta.url),'utf8');
const script = await readFile(new URL('../frontend-v2/scripts/wedding-music.js',import.meta.url),'utf8');
const css = await readFile(new URL('../frontend-v2/styles/music.css',import.meta.url),'utf8');

class FakeClassList {
  values = new Set();
  toggle(value,force) {
    if (force) this.values.add(value); else this.values.delete(value);
  }
  contains(value) { return this.values.has(value); }
}

class FakeButton extends EventTarget {
  attributes = new Map();
  classList = new FakeClassList();
  setAttribute(name,value) { this.attributes.set(name,value); }
  getAttribute(name) { return this.attributes.get(name); }
}

class FakeAudio extends EventTarget {
  paused = true;
  ended = false;
  volume = 1;
  playCalls = 0;
  pauseCalls = 0;
  rejectPlay = false;
  async play() {
    this.playCalls += 1;
    if (this.rejectPlay) throw new Error('blocked');
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event('play'));
  }
  pause() {
    this.pauseCalls += 1;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

function setup() {
  const audio = new FakeAudio();
  const button = new FakeButton();
  const documentTarget = new EventTarget();
  const windowTarget = new EventTarget();
  const controller = initWeddingMusic({audio,button,documentTarget,windowTarget});
  return {audio,button,documentTarget,windowTarget,controller};
}

function touchEvent(type,y,{touches=true}={}) {
  const event = new Event(type);
  Object.defineProperty(event,touches?'touches':'changedTouches',{value:[{clientY:y}]});
  return event;
}

function swipe(target,startY,endY) {
  target.dispatchEvent(touchEvent('touchstart',startY));
  target.dispatchEvent(touchEvent('touchend',endY,{touches:false}));
}

const flush = () => new Promise(resolve=>setImmediate(resolve));

test('one persistent wedding audio element exists',()=>{
  assert.equal([...html.matchAll(/<audio\b/g)].length,1);
  assert.match(html,/<audio id="wedding-music"/);
});

test('audio never requests autoplay',()=>{
  const tag = html.match(/<audio[\s\S]*?>/)[0];
  assert.doesNotMatch(tag,/\bautoplay\b/);
});

test('audio loops continuously',()=>{
  assert.match(html,/<audio id="wedding-music" loop/);
});

test('audio uses conservative metadata preload',()=>{
  assert.match(html,/<audio[^>]+preload="metadata"/);
  assert.doesNotMatch(html,/<audio[^>]+preload="auto"/);
});

test('audio source is the single optimized M4A asset',()=>{
  assert.equal([...html.matchAll(/<source\b/g)].length,1);
  assert.match(html,/src="assets\/audio\/canon-in-love\.m4a" type="audio\/mp4"/);
});

test('music control is a real button with a paused initial state',()=>{
  assert.match(html,/<button class="music-control" id="music-control" type="button" aria-label="Play background music" aria-pressed="false">/);
});

test('controller initializes paused UI and volume 0.35',()=>{
  const {audio,button} = setup();
  assert.equal(WEDDING_MUSIC_VOLUME,0.35);
  assert.equal(audio.volume,0.35);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(button.getAttribute('aria-label'),'Play background music');
  assert.equal(button.classList.contains('is-playing'),false);
  assert.deepEqual(setup().controller.getState(),{autoStartArmed:true,explicitDecision:false});
});

test('qualifying upward touch swipe calls play directly from touchend',async()=>{
  const {audio,documentTarget} = setup();
  let dispatching = false;
  let calledDuringGesture = false;
  audio.play = () => {
    calledDuringGesture = dispatching;
    audio.playCalls += 1;
    audio.paused = false;
    audio.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  documentTarget.dispatchEvent(touchEvent('touchstart',200));
  dispatching = true;
  documentTarget.dispatchEvent(touchEvent('touchend',200-WEDDING_MUSIC_SWIPE_THRESHOLD,{touches:false}));
  dispatching = false;
  await flush();
  assert.equal(audio.playCalls,1);
  assert.equal(calledDuringGesture,true);
});

test('movement below the swipe threshold does not start music',async()=>{
  const {audio,documentTarget,controller} = setup();
  swipe(documentTarget,200,200-WEDDING_MUSIC_SWIPE_THRESHOLD+1);
  await flush();
  assert.equal(audio.playCalls,0);
  assert.equal(controller.getState().autoStartArmed,true);
});

test('opposite-direction touch swipe does not start music',async()=>{
  const {audio,documentTarget,controller} = setup();
  swipe(documentTarget,100,150);
  await flush();
  assert.equal(audio.playCalls,0);
  assert.equal(controller.getState().autoStartArmed,true);
});

test('scroll event alone never starts music',()=>{
  const {audio,documentTarget} = setup();
  documentTarget.dispatchEvent(new Event('scroll'));
  assert.equal(audio.playCalls,0);
});

test('desktop wheel event never starts music',()=>{
  const {audio,documentTarget} = setup();
  documentTarget.dispatchEvent(new Event('wheel'));
  assert.equal(audio.playCalls,0);
});

test('manual Play disables swipe auto-start',async()=>{
  const {audio,button,documentTarget,controller} = setup();
  button.dispatchEvent(new Event('click'));
  await flush();
  assert.deepEqual(controller.getState(),{autoStartArmed:false,explicitDecision:true});
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,1);
});

test('manual Pause locks out future swipe playback',async()=>{
  const {audio,button,documentTarget,controller} = setup();
  swipe(documentTarget,200,100);
  await flush();
  button.dispatchEvent(new Event('click'));
  await flush();
  assert.equal(audio.pauseCalls,1);
  assert.deepEqual(controller.getState(),{autoStartArmed:false,explicitDecision:true});
  swipe(documentTarget,200,100);
  documentTarget.dispatchEvent(new Event('scroll'));
  await flush();
  assert.equal(audio.playCalls,1);
  assert.equal(audio.paused,true);
});

test('successful swipe playback updates the normal playing UI',async()=>{
  const {audio,button,documentTarget,controller} = setup();
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(button.getAttribute('aria-label'),'Pause background music');
  assert.deepEqual(controller.getState(),{autoStartArmed:false,explicitDecision:false});
});

test('rejected swipe playback is safe and is not retried',async()=>{
  const {audio,button,documentTarget,controller} = setup();
  audio.rejectPlay = true;
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,1);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(controller.getState().autoStartArmed,false);
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,1);
});

test('swipe auto-start makes only one qualifying attempt',async()=>{
  const {audio,documentTarget} = setup();
  swipe(documentTarget,200,100);
  await flush();
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,1);
});

test('fresh controller initialization re-arms swipe auto-start',async()=>{
  const first = setup();
  swipe(first.documentTarget,200,100);
  await flush();
  assert.equal(first.controller.getState().autoStartArmed,false);
  const reloaded = setup();
  assert.deepEqual(reloaded.controller.getState(),{autoStartArmed:true,explicitDecision:false});
  swipe(reloaded.documentTarget,200,100);
  await flush();
  assert.equal(reloaded.audio.playCalls,1);
});

test('play invokes audio.play and updates only after playback succeeds',async()=>{
  const {audio,button,controller} = setup();
  let resolvePlay;
  audio.play = () => {
    audio.playCalls += 1;
    return new Promise(resolve => { resolvePlay = () => { audio.paused=false; resolve(); }; });
  };
  const pending = controller.togglePlayback();
  assert.equal(audio.playCalls,1);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  resolvePlay();
  await pending;
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(button.getAttribute('aria-label'),'Pause background music');
});

test('clicking the control starts playback',async()=>{
  const {audio,button} = setup();
  button.dispatchEvent(new Event('click'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(audio.playCalls,1);
  assert.equal(button.getAttribute('aria-pressed'),'true');
});

test('a rejected play promise is handled and leaves paused UI',async()=>{
  const {audio,button,controller} = setup();
  audio.rejectPlay = true;
  await assert.doesNotReject(controller.togglePlayback());
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(button.getAttribute('aria-label'),'Play background music');
});

test('clicking while playing pauses real audio and UI',async()=>{
  const {audio,button,controller} = setup();
  await controller.togglePlayback();
  await controller.togglePlayback();
  assert.equal(audio.pauseCalls,1);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(button.classList.contains('is-playing'),false);
});

test('play pause and ended events synchronize UI',()=>{
  const {audio,button} = setup();
  audio.paused=false;
  audio.dispatchEvent(new Event('play'));
  assert.equal(button.getAttribute('aria-pressed'),'true');
  audio.paused=true;
  audio.ended=true;
  audio.dispatchEvent(new Event('ended'));
  assert.equal(button.getAttribute('aria-pressed'),'false');
});

test('audio errors do not throw or mark playback active',()=>{
  const {audio,button} = setup();
  assert.doesNotThrow(()=>audio.dispatchEvent(new Event('error')));
  assert.equal(button.getAttribute('aria-pressed'),'false');
});

test('visibility changes only synchronize and never pause audio',()=>{
  const {audio,documentTarget} = setup();
  audio.paused=false;
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(audio.pauseCalls,0);
  assert.equal(audio.paused,false);
});

test('music logic has no token storage analytics or logging dependency',()=>{
  assert.doesNotMatch(script,/token|localStorage|sessionStorage|analytics|console\./i);
});

test('control meets touch target safe-area and reduced-motion requirements',()=>{
  assert.match(css,/width: 46px;[\s\S]*height: 46px/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.match(css,/env\(safe-area-inset-right\)/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
});

test('build allowlist includes the audio UI and one public audio file',()=>{
  assert.ok(openingFiles.includes('frontend-v2/styles/music.css'));
  assert.ok(openingFiles.includes('frontend-v2/scripts/wedding-music.js'));
  assert.deepEqual(openingFiles.filter(value=>value.startsWith('frontend-v2/assets/audio/')),['frontend-v2/assets/audio/canon-in-love.m4a']);
});

test('published audio remains materially smaller than the approved source',async()=>{
  const source = await stat('/Users/ngyuhui/Desktop/1205/卡農 in LoveCanon in Love  Official MV - 蔡佩軒 Ariel Tsai.m4a');
  const published = await stat(new URL('../frontend-v2/assets/audio/canon-in-love.m4a',import.meta.url));
  assert.ok(published.size < source.size * 0.6);
});

test('approved Open Graph copy remains unchanged in the r5 build',()=>{
  const metadata = renderShareMetadata('release-v2-20260927-r5');
  assert.match(metadata,/<meta property="og:title" content="Louis &amp; Joyce · Wedding Invitation" \/>/);
  assert.match(metadata,/<meta property="og:description" content="We're getting married · 23 January 2027" \/>/);
  assert.match(metadata,/<link rel="canonical" href="https:\/\/louisnyh\.github\.io\/wedding-invitation\/" \/>/);
  assert.match(metadata,/<meta property="og:image" content="https:\/\/louisnyh\.github\.io\/wedding-invitation\/release-v2-20260922-r3\/assets\/social\/wedding-share-2027-og\.jpg" \/>/);
  assert.match(metadata,/<meta name="twitter:image" content="https:\/\/louisnyh\.github\.io\/wedding-invitation\/release-v2-20260922-r3\/assets\/social\/wedding-share-2027-og\.jpg" \/>/);
  assert.equal([...metadata.matchAll(/<meta property="og:image" /g)].length,1);
});

test('backend candidate and previous immutable releases remain untouched',()=>{
  assert.doesNotThrow(()=>execFileSync('git',['diff','--quiet','origin/main','--','apps-script.gs','candidate-v2','release-v2-20260921','release-v2-20260922-r2','release-v2-20260922-r3','release-v2-20260926-r4'],{cwd:root}));
});

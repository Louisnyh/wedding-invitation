import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import {openingFiles,renderShareMetadata} from '../scripts/build.mjs';
import {initWeddingMusic,WEDDING_MUSIC_MAX_SWIPE_ATTEMPTS,WEDDING_MUSIC_SWIPE_THRESHOLD,WEDDING_MUSIC_VOLUME} from '../frontend-v2/scripts/wedding-music.js';

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
  playOutcomes = [];
  constructor(playOutcomes=[]) {
    super();
    this.playOutcomes=[...playOutcomes];
  }
  async play() {
    this.playCalls += 1;
    const outcome=this.playOutcomes.shift();
    if(typeof outcome==='function') return outcome(this);
    if(outcome instanceof Error) throw outcome;
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

function playError(name='NotAllowedError') {
  const error=new Error(name);
  error.name=name;
  return error;
}

function setup({playOutcomes=[]}={}) {
  const audio = new FakeAudio(playOutcomes);
  const button = new FakeButton();
  const documentTarget = new EventTarget();
  const windowTarget = new EventTarget();
  const controller = initWeddingMusic({audio,button,documentTarget,windowTarget});
  return {audio,button,documentTarget,windowTarget,controller};
}

function touchEvent(type,y,{touches=true,identifier=1}={}) {
  const event = new Event(type);
  Object.defineProperty(event,touches?'touches':'changedTouches',{value:[{clientY:y,identifier}]});
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

test('controller starts paused, keeps volume 0.35, and makes one explicit initialization attempt',async()=>{
  let rejectInitial;
  const pending=new Promise((resolve,reject)=>{rejectInitial=reject;});
  const {audio,button,controller}=setup({playOutcomes:[()=>pending]});
  assert.equal(WEDDING_MUSIC_VOLUME,0.35);
  assert.equal(audio.volume,0.35);
  assert.equal(audio.paused,true);
  assert.equal(audio.playCalls,1);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.deepEqual(controller.getState(),{autoStartArmed:false,explicitDecision:false,autoplayPending:true,swipeAttemptPending:false,swipeAttempts:0});
  rejectInitial(playError());
  await controller.initialAttempt;
  assert.equal(audio.playCalls,1);
});

test('successful page-load autoplay synchronizes UI and disables swipe fallback',async()=>{
  const {audio,button,documentTarget,controller}=setup();
  assert.equal(await controller.initialAttempt,true);
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(button.getAttribute('aria-label'),'Pause background music');
  assert.equal(controller.getState().autoStartArmed,false);
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,1);
});

test('rejected page-load autoplay stays paused and arms swipe fallback without consuming a retry',async()=>{
  const {audio,button,controller}=setup({playOutcomes:[playError('NotAllowedError')]});
  assert.equal(await controller.initialAttempt,false);
  assert.equal(audio.paused,true);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.deepEqual(controller.getState(),{autoStartArmed:true,explicitDecision:false,autoplayPending:false,swipeAttemptPending:false,swipeAttempts:0});
});

test('qualifying upward touch swipe calls play directly from touchend',async()=>{
  const instance=setup({playOutcomes:[playError()]});
  await instance.controller.initialAttempt;
  let dispatching=false;
  let calledDuringGesture=false;
  instance.audio.play=()=>{
    calledDuringGesture=dispatching;
    instance.audio.playCalls+=1;
    instance.audio.paused=false;
    instance.audio.dispatchEvent(new Event('play'));
    return Promise.resolve();
  };
  instance.documentTarget.dispatchEvent(touchEvent('touchstart',200));
  dispatching=true;
  instance.documentTarget.dispatchEvent(touchEvent('touchend',200-WEDDING_MUSIC_SWIPE_THRESHOLD,{touches:false}));
  dispatching=false;
  await flush();
  assert.equal(instance.audio.playCalls,2);
  assert.equal(calledDuringGesture,true);
});

test('successful first swipe disables further automatic attempts',async()=>{
  const {audio,documentTarget,controller}=setup({playOutcomes:[playError(),undefined]});
  await controller.initialAttempt;
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,2);
  assert.equal(controller.getState().autoStartArmed,false);
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,2);
});

test('rejected first and second swipes remain armed and retry',async()=>{
  const {audio,documentTarget,controller}=setup({playOutcomes:[playError(),playError(),playError(),undefined]});
  await controller.initialAttempt;
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,2);
  assert.equal(controller.getState().swipeAttempts,1);
  assert.equal(controller.getState().autoStartArmed,true);
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,3);
  assert.equal(controller.getState().swipeAttempts,2);
  assert.equal(controller.getState().autoStartArmed,true);
});

test('third rejected swipe exhausts retries and a fourth swipe makes no attempt',async()=>{
  assert.equal(WEDDING_MUSIC_MAX_SWIPE_ATTEMPTS,3);
  const errors=[playError(),playError(),playError(),playError()];
  const {audio,documentTarget,controller}=setup({playOutcomes:errors});
  await controller.initialAttempt;
  for(let attempt=1;attempt<=3;attempt+=1){swipe(documentTarget,200,100);await flush();}
  assert.equal(audio.playCalls,4);
  assert.equal(controller.getState().swipeAttempts,3);
  assert.equal(controller.getState().autoStartArmed,false);
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,4);
});

test('short, downward, cancelled, and wrong-finger gestures consume no retry',async()=>{
  const {audio,documentTarget,controller}=setup({playOutcomes:[playError(),undefined]});
  await controller.initialAttempt;
  swipe(documentTarget,200,200-WEDDING_MUSIC_SWIPE_THRESHOLD+1);
  swipe(documentTarget,100,150);
  documentTarget.dispatchEvent(touchEvent('touchstart',200));
  documentTarget.dispatchEvent(new Event('touchcancel'));
  documentTarget.dispatchEvent(touchEvent('touchstart',200,{identifier:7}));
  documentTarget.dispatchEvent(touchEvent('touchend',100,{touches:false,identifier:8}));
  await flush();
  assert.equal(audio.playCalls,1);
  assert.equal(controller.getState().swipeAttempts,0);
  assert.equal(controller.getState().autoStartArmed,true);
});

test('opening and referrer source never change fallback behavior',async()=>{
  for(const referrer of ['', 'https://web.whatsapp.com/','https://t.me/','https://www.messenger.com/','https://www.google.com/']) {
    const instance=setup({playOutcomes:[playError(),undefined]});
    Object.defineProperty(instance.documentTarget,'referrer',{value:referrer});
    await instance.controller.initialAttempt;
    swipe(instance.documentTarget,200,100);
    await flush();
    assert.equal(instance.audio.playCalls,2,referrer);
  }
});

test('music startup contains no source detection or forbidden retry mechanism',()=>{
  assert.doesNotMatch(script,/whatsapp|telegram|messenger|userAgent|navigator\.userAgent|document\.referrer|location\.(?:href|search|host)/i);
  assert.doesNotMatch(script,/setTimeout|requestAnimationFrame|IntersectionObserver|\.dispatchEvent\(new MouseEvent|\.click\(\)/);
});

test('scroll and desktop wheel events never trigger playback',async()=>{
  const {audio,documentTarget,controller}=setup({playOutcomes:[playError()]});
  await controller.initialAttempt;
  documentTarget.dispatchEvent(new Event('scroll'));
  documentTarget.dispatchEvent(new Event('wheel'));
  assert.equal(audio.playCalls,1);
  assert.equal(controller.getState().swipeAttempts,0);
});

test('manual Play disables all automatic behavior',async()=>{
  const {audio,button,documentTarget,controller}=setup({playOutcomes:[playError(),undefined]});
  await controller.initialAttempt;
  button.dispatchEvent(new Event('click'));
  await flush();
  assert.equal(controller.getState().explicitDecision,true);
  assert.equal(controller.getState().autoStartArmed,false);
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,2);
});

test('manual Pause disables automatic behavior and later swipes never restart',async()=>{
  const {audio,button,documentTarget,controller}=setup();
  await controller.initialAttempt;
  button.dispatchEvent(new Event('click'));
  await flush();
  assert.equal(audio.pauseCalls,1);
  assert.equal(audio.paused,true);
  assert.equal(controller.getState().explicitDecision,true);
  assert.equal(controller.getState().autoStartArmed,false);
  swipe(documentTarget,200,100);
  await flush();
  assert.equal(audio.playCalls,1);
  assert.equal(audio.paused,true);
});

test('manual play updates only after its playback promise succeeds',async()=>{
  let resolveManual;
  const manualPending=new Promise(resolve=>{resolveManual=resolve;});
  const {audio,button,controller}=setup({playOutcomes:[playError(),instance=>manualPending.then(()=>{instance.paused=false;instance.dispatchEvent(new Event('play'));})]});
  await controller.initialAttempt;
  const pending=controller.togglePlayback();
  assert.equal(audio.playCalls,2);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  resolveManual();
  await pending;
  assert.equal(button.getAttribute('aria-pressed'),'true');
});

test('rejected manual play is silent and leaves paused UI',async()=>{
  const {audio,button,controller}=setup({playOutcomes:[playError(),playError('AbortError')]});
  await controller.initialAttempt;
  await assert.doesNotReject(controller.togglePlayback());
  assert.equal(audio.playCalls,2);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(button.getAttribute('aria-label'),'Play background music');
});

test('play pause and ended events synchronize UI',async()=>{
  const {audio,button,controller} = setup({playOutcomes:[playError()]});
  await controller.initialAttempt;
  audio.paused=false;
  audio.dispatchEvent(new Event('play'));
  assert.equal(button.getAttribute('aria-pressed'),'true');
  audio.paused=true;
  audio.ended=true;
  audio.dispatchEvent(new Event('ended'));
  assert.equal(button.getAttribute('aria-pressed'),'false');
});

test('audio errors do not throw or mark playback active',async()=>{
  const {audio,button,controller} = setup({playOutcomes:[playError('NotSupportedError')]});
  await controller.initialAttempt;
  assert.doesNotThrow(()=>audio.dispatchEvent(new Event('error')));
  assert.equal(button.getAttribute('aria-pressed'),'false');
});

test('visibility changes only synchronize and never pause audio',async()=>{
  const {audio,documentTarget,controller} = setup();
  await controller.initialAttempt;
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
  assert.doesNotThrow(()=>execFileSync('git',['diff','--quiet','origin/main','--','apps-script.gs','candidate-v2','release-v2-20260921','release-v2-20260922-r2','release-v2-20260922-r3','release-v2-20260926-r4','release-v2-20260927-r5','release-v2-20261002-r6'],{cwd:root}));
});

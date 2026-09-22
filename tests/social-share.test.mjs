import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {WEDDING_CONTENT} from '../frontend-v2/scripts/wedding-content.js';
import {renderShareMetadata} from '../scripts/build.mjs';

const namespace = 'release-v2-20260922-r3';
const metadata = renderShareMetadata(namespace);
const sourceImage = new URL('../frontend-v2/assets/social/wedding-share-2027-landscape.png',import.meta.url);
const ogImage = new URL('../frontend-v2/assets/social/wedding-share-2027-og.jpg',import.meta.url);

function metaContent(attribute,name) {
  const match = metadata.match(new RegExp(`<meta ${attribute}="${name.replaceAll(':','\\:')}" content="([^"]*)" \\/>`));
  assert.ok(match,`${attribute}=${name}`);
  return match[1];
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1,4).toString(),'PNG');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}

function jpegDimensions(buffer) {
  assert.equal(buffer.readUInt16BE(0),0xffd8);
  const startOfFrame = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let offset=2;
  while(offset<buffer.length) {
    while(buffer[offset]===0xff) offset+=1;
    const marker=buffer[offset++];
    if(marker===0xd8||marker===0xd9) continue;
    const length=buffer.readUInt16BE(offset);
    if(startOfFrame.has(marker)) return {height:buffer.readUInt16BE(offset+3),width:buffer.readUInt16BE(offset+5)};
    offset+=length;
  }
  throw new Error('JPEG dimensions not found');
}

function jpegIccProfile(buffer) {
  const chunks=[];
  let offset=2;
  while(offset<buffer.length) {
    while(buffer[offset]===0xff) offset+=1;
    const marker=buffer[offset++];
    if(marker===0xd8||marker===0xd9) continue;
    if(marker===0xda) break;
    const length=buffer.readUInt16BE(offset);
    const payload=buffer.subarray(offset+2,offset+length);
    if(marker===0xe2&&payload.subarray(0,12).toString('ascii')==='ICC_PROFILE\0') {
      chunks[payload[12]-1]=payload.subarray(14);
    }
    offset+=length;
  }
  return Buffer.concat(chunks);
}

test('canonical share values use the approved copy and derive the 2027 date',()=>{
  assert.deepEqual(WEDDING_CONTENT.share,{
    title:'Louis & Joyce · Wedding Invitation',
    description:"We're getting married · 23 January 2027",
    canonicalUrl:'https://louisnyh.github.io/wedding-invitation/',
    imageAlt:'Louis and Joyce walking together by the sea at sunset on their wedding invitation cover.',
    ogImageAsset:'assets/social/wedding-share-2027-og.jpg'
  });
  assert.equal(WEDDING_CONTENT.event.dateISO,'2027-01-23');
});

test('approved landscape source remains 1672 by 941',async()=>{
  assert.deepEqual(pngDimensions(await readFile(sourceImage)),{width:1672,height:941});
});

test('Open Graph JPEG is exactly 1200 by 630',async()=>{
  assert.deepEqual(jpegDimensions(await readFile(ogImage)),{width:1200,height:630});
});

test('Open Graph JPEG embeds the sRGB IEC61966-2.1 profile',async()=>{
  const profile=jpegIccProfile(await readFile(ogImage));
  assert.equal(createHash('sha256').update(profile).digest('hex'),'2b3aa1645779a9e634744faf9b01e9102b0c9b88fd6deced7934df86b949af7e');
});

test('built metadata declares website Open Graph type',()=>{
  assert.equal(metaContent('property','og:type'),'website');
});

test('built metadata declares the Louis and Joyce site name',()=>{
  assert.equal(metaContent('property','og:site_name'),'Louis &amp; Joyce');
});

test('built metadata declares the approved Open Graph title',()=>{
  assert.equal(metaContent('property','og:title'),'Louis &amp; Joyce · Wedding Invitation');
});

test('built metadata declares the approved Open Graph description',()=>{
  assert.equal(metaContent('property','og:description'),"We're getting married · 23 January 2027");
});

test('built metadata canonicalizes og:url to the clean public root',()=>{
  assert.equal(metaContent('property','og:url'),'https://louisnyh.github.io/wedding-invitation/');
});

test('built metadata contains exactly one primary og:image',()=>{
  assert.equal([...metadata.matchAll(/<meta property="og:image" /g)].length,1);
});

test('og:image is an absolute HTTPS URL',()=>{
  const url=new URL(metaContent('property','og:image'));
  assert.equal(url.protocol,'https:');
  assert.equal(url.origin,'https://louisnyh.github.io');
});

test('og:image points to r3 and the approved JPEG asset',()=>{
  assert.equal(metaContent('property','og:image'),`https://louisnyh.github.io/wedding-invitation/${namespace}/assets/social/wedding-share-2027-og.jpg`);
});

test('Open Graph image type, dimensions and alt text are explicit',()=>{
  assert.equal(metaContent('property','og:image:type'),'image/jpeg');
  assert.equal(metaContent('property','og:image:width'),'1200');
  assert.equal(metaContent('property','og:image:height'),'630');
  assert.equal(metaContent('property','og:image:alt'),WEDDING_CONTENT.share.imageAlt);
});

test('canonical link remains the clean public root',()=>{
  assert.match(metadata,/<link rel="canonical" href="https:\/\/louisnyh\.github\.io\/wedding-invitation\/" \/>/);
});

test('Twitter uses the approved large-card title and description',()=>{
  assert.equal(metaContent('name','twitter:card'),'summary_large_image');
  assert.equal(metaContent('name','twitter:title'),'Louis &amp; Joyce · Wedding Invitation');
  assert.equal(metaContent('name','twitter:description'),"We're getting married · 23 January 2027");
});

test('Twitter image and alt match the primary Open Graph image',()=>{
  assert.equal(metaContent('name','twitter:image'),metaContent('property','og:image'));
  assert.equal(metaContent('name','twitter:image:alt'),metaContent('property','og:image:alt'));
});

test('social metadata never includes tokenized or inherited URLs',()=>{
  assert.doesNotMatch(metadata,/\?token=|[?&]token=|PREVIEW_TOKEN|STAGING_GUEST_TOKEN/);
  assert.doesNotMatch(metaContent('property','og:url'),/\?/);
  assert.doesNotMatch(metaContent('property','og:image'),/\?/);
});

test('existing immutable releases, candidate and Apps Script remain untouched',()=>{
  assert.doesNotThrow(()=>execFileSync('git',['diff','--quiet','origin/main','--','candidate-v2','release-v2-20260921','release-v2-20260922-r2','apps-script.gs'],{cwd:new URL('..',import.meta.url)}));
});

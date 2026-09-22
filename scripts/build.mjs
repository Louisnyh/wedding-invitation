import { mkdir,rm,copyFile,readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve,dirname } from 'node:path';
import { WEDDING_CONTENT } from '../frontend-v2/scripts/wedding-content.js';
export const root = fileURLToPath(new URL('../',import.meta.url));
export const shippedFiles = ['index.html','style.css','script.js','js/api.js','js/schema.js','js/rsvp-state.js','js/table-check.js','js/config.js','assets/photos/hero-main.webp','assets/photos/story-01.webp','assets/photos/personal-note.webp','assets/google-maps.png','assets/waze.png'];
export const openingFiles = ['frontend-v2/index.html','frontend-v2/styles/tokens.css','frontend-v2/styles/base.css','frontend-v2/styles/page-01.css','frontend-v2/styles/page-02.css','frontend-v2/styles/page-03-04.css','frontend-v2/styles/page-05.css','frontend-v2/styles/page-06.css','frontend-v2/styles/page-07.css','frontend-v2/styles/page-08.css','frontend-v2/styles/motion.css','frontend-v2/scripts/wedding-content.js','frontend-v2/scripts/wedding-content-renderer.js','frontend-v2/scripts/countdown.js','frontend-v2/scripts/editorial-sequence.js','frontend-v2/scripts/reveal.js','frontend-v2/scripts/rsvp-adapter.js','js/api.js','js/schema.js','js/rsvp-state.js','js/config.js','frontend-v2/assets/photos/hero-main.webp','frontend-v2/assets/photos/love-story-8433a-20.jpg','frontend-v2/assets/photos/forever-starts-here-8433a-54.jpg','frontend-v2/assets/photos/louis-portrait-8433a-53.jpg','frontend-v2/assets/photos/joyce-portrait-8433a-57.jpg','frontend-v2/assets/photos/emotional-closing-8433a-113.jpg'];
export const socialFiles = [
  {source:'frontend-v2/assets/social/wedding-share-2027-landscape.png',asset:'assets/social/wedding-share-2027-landscape.png'},
  {source:'frontend-v2/assets/social/wedding-share-2027-og.jpg',asset:'assets/social/wedding-share-2027-og.jpg'}
];

const shareMarker = '    <!-- wedding-share-metadata -->';
const escapeAttribute = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;');

export function renderShareMetadata(publicRootNamespace='') {
  const share = WEDDING_CONTENT.share;
  const assetPrefix = publicRootNamespace ? `${publicRootNamespace}/` : 'frontend-v2/';
  const imageUrl = new URL(`${assetPrefix}${share.ogImageAsset}`,share.canonicalUrl).href;
  const title = escapeAttribute(share.title);
  const description = escapeAttribute(share.description);
  const canonicalUrl = escapeAttribute(share.canonicalUrl);
  const image = escapeAttribute(imageUrl);
  const imageAlt = escapeAttribute(share.imageAlt);
  return [
    `    <link rel="canonical" href="${canonicalUrl}" />`,
    '    <meta property="og:type" content="website" />',
    '    <meta property="og:site_name" content="Louis &amp; Joyce" />',
    `    <meta property="og:title" content="${title}" />`,
    `    <meta property="og:description" content="${description}" />`,
    `    <meta property="og:url" content="${canonicalUrl}" />`,
    `    <meta property="og:image" content="${image}" />`,
    `    <meta property="og:image:secure_url" content="${image}" />`,
    '    <meta property="og:image:type" content="image/jpeg" />',
    '    <meta property="og:image:width" content="1200" />',
    '    <meta property="og:image:height" content="630" />',
    `    <meta property="og:image:alt" content="${imageAlt}" />`,
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${title}" />`,
    `    <meta name="twitter:description" content="${description}" />`,
    `    <meta name="twitter:image" content="${image}" />`,
    `    <meta name="twitter:image:alt" content="${imageAlt}" />`
  ].join('\n');
}

async function renderWeddingHtml(publicRootNamespace='') {
  const source = await readFile(resolve(root,'frontend-v2/index.html'),'utf8');
  if (!source.includes(shareMarker)) throw new Error('Wedding share metadata marker missing');
  return source.replace(shareMarker,renderShareMetadata(publicRootNamespace));
}
export async function build({staging=false,apiUrl='',frontend='legacy',previewToken='',publicRootNamespace=''}={}) {
  if (!['legacy','v2'].includes(frontend)) throw new Error('Unknown frontend');
  if (staging && apiUrl) throw new Error('Choose local staging or a remote API, not both');
  if (apiUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(apiUrl)) throw new Error('Expected an explicit Apps Script v2 deployment URL');
  if (publicRootNamespace && (frontend !== 'v2' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(publicRootNamespace))) throw new Error('Expected a safe v2 public-root namespace');
  if (frontend === 'v2') {
    const dist = resolve(root, 'dist-v2');
    await rm(dist, {recursive:true, force:true});
    const prefix = publicRootNamespace ? `${publicRootNamespace}/` : '';
    for (const file of openingFiles) {
      const target = resolve(dist, prefix, file);
      await mkdir(dirname(target), {recursive:true});
      await copyFile(resolve(root, file), target);
    }
    const socialRoot = resolve(dist,prefix,publicRootNamespace?'':'frontend-v2');
    for (const file of socialFiles) {
      const target = resolve(socialRoot,file.asset);
      await mkdir(dirname(target),{recursive:true});
      await copyFile(resolve(root,file.source),target);
    }
    const releaseHtml = await renderWeddingHtml(publicRootNamespace);
    await writeFile(resolve(dist,prefix,'frontend-v2/index.html'),releaseHtml);
    await writeFile(resolve(dist,prefix,'js/config.js'),`// Generated configuration. No guest data.\nexport const API_URL = ${JSON.stringify(staging?'/api':apiUrl)};\nexport const PREVIEW_TOKEN = ${JSON.stringify(staging?previewToken:'')};\n`);
    if (publicRootNamespace) {
      const publicHtml = releaseHtml.replace('</title>',`</title>\n    <base href="./${publicRootNamespace}/frontend-v2/" />`);
      await writeFile(resolve(dist,'index.html'),publicHtml);
    }
    return dist;
  }
  const dist=resolve(root,'dist');await rm(dist,{recursive:true,force:true});
  for(const file of shippedFiles){const target=resolve(dist,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,file),target);}
  await writeFile(resolve(dist,'js/config.js'),`// Generated configuration. No guest data.\nexport const API_URL = ${JSON.stringify(staging?'/api':apiUrl)};\nexport const PREVIEW_TOKEN = "";\n`);
  for(const file of shippedFiles.filter(file=>/\.(js|html)$/.test(file))) {
    const code=await readFile(resolve(dist,file),'utf8');
    if(/sampleData|console\.(log|warn|error)|confirmedGroupMembers|submitMemory|createTableVisibility|guest_id|invite_url/.test(code)) throw new Error(`Forbidden legacy surface in ${file}`);
  }
  return dist;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);const index=args.indexOf('--api-url');const publicRootIndex=args.indexOf('--public-root');
  if(index>=0&&!args[index+1])throw new Error('--api-url requires a value');
  if(publicRootIndex>=0&&!args[publicRootIndex+1])throw new Error('--public-root requires a namespace');
  await build({staging:args.includes('--staging'),apiUrl:index<0?'':args[index+1],frontend:args.includes('--v2')?'v2':'legacy',publicRootNamespace:publicRootIndex<0?'':args[publicRootIndex+1]});
  console.log(`Built ${args.includes('--v2')?'dist-v2':'dist'}/ from an explicit public-file allowlist. No deployment performed.`);
}

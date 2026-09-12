import { mkdir,rm,copyFile,readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve,dirname } from 'node:path';
export const root = fileURLToPath(new URL('../',import.meta.url));
export const shippedFiles = ['index.html','style.css','script.js','js/api.js','js/schema.js','js/rsvp-state.js','js/table-check.js','js/config.js','assets/photos/hero-main.webp','assets/photos/story-01.webp','assets/photos/personal-note.webp','assets/google-maps.png','assets/waze.png'];
export const openingFiles = ['frontend-v2/index.html','frontend-v2/styles/tokens.css','frontend-v2/styles/base.css','frontend-v2/styles/page-01.css','frontend-v2/styles/page-02.css','frontend-v2/styles/page-03-04.css','frontend-v2/styles/page-05.css','frontend-v2/styles/page-06.css','frontend-v2/styles/page-07.css','frontend-v2/styles/motion.css','frontend-v2/scripts/countdown.js','frontend-v2/scripts/editorial-sequence.js','frontend-v2/scripts/reveal.js','assets/photos/hero-main.webp','assets/photos/love-story-8433a-20.jpg','assets/photos/forever-starts-here-8433a-54.jpg','assets/photos/louis-portrait-8433a-53.jpg','assets/photos/joyce-portrait-8433a-57.jpg','assets/photos/emotional-closing-8433a-113.jpg'];
export async function build({staging=false,apiUrl='',frontend='legacy'}={}) {
  if (!['legacy','v2'].includes(frontend)) throw new Error('Unknown frontend');
  if (frontend === 'v2') {
    if (apiUrl) throw new Error('Frontend v2 has no API integration');
    const dist = resolve(root, 'dist-v2');
    await rm(dist, {recursive:true, force:true});
    for (const file of openingFiles) {
      const target = resolve(dist, file);
      await mkdir(dirname(target), {recursive:true});
      await copyFile(resolve(root, file), target);
    }
    return dist;
  }
  if (staging && apiUrl) throw new Error('Choose local staging or a remote API, not both');
  if (apiUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(apiUrl)) throw new Error('Expected an explicit Apps Script v2 deployment URL');
  const dist=resolve(root,'dist');await rm(dist,{recursive:true,force:true});
  for(const file of shippedFiles){const target=resolve(dist,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,file),target);}
  await writeFile(resolve(dist,'js/config.js'),`// Generated configuration. No guest data.\nexport const API_URL = ${JSON.stringify(staging?'/api':apiUrl)};\n`);
  for(const file of shippedFiles.filter(file=>/\.(js|html)$/.test(file))) {
    const code=await readFile(resolve(dist,file),'utf8');
    if(/sampleData|console\.(log|warn|error)|confirmedGroupMembers|submitMemory|createTableVisibility|guest_id|invite_url/.test(code)) throw new Error(`Forbidden legacy surface in ${file}`);
  }
  return dist;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);const index=args.indexOf('--api-url');
  if(index>=0&&!args[index+1])throw new Error('--api-url requires a value');
  await build({staging:args.includes('--staging'),apiUrl:index<0?'':args[index+1],frontend:args.includes('--v2')?'v2':'legacy'});
  console.log(`Built ${args.includes('--v2')?'dist-v2':'dist'}/ from an explicit public-file allowlist. No deployment performed.`);
}

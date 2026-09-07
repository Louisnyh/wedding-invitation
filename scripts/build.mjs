import { mkdir,rm,copyFile,readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve,dirname } from 'node:path';
export const root = fileURLToPath(new URL('../',import.meta.url));
export const shippedFiles = ['index.html','style.css','script.js','js/api.js','js/schema.js','js/rsvp-state.js','js/table-check.js','js/config.js','assets/photos/hero-main.webp','assets/photos/story-01.webp','assets/photos/personal-note.webp','assets/google-maps.png','assets/waze.png'];
export async function build({staging=false,apiUrl=''}={}) {
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
  await build({staging:args.includes('--staging'),apiUrl:index<0?'':args[index+1]});
  console.log('Built dist/ from an explicit public-file allowlist. No deployment performed.');
}

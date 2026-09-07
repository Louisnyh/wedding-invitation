import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fixtures } from './fixtures.mjs';
export function createHarness({now='2026-11-27T15:59:59.000Z'}={}) {
  const data = fixtures();
  const stats = {reads:[],writes:[],requests:[],locked:false};
  const control = {now,failWrite:false,loseWriteResponse:false,failRead:false,lockAvailable:true,onLock:null};
  const properties = {ENVIRONMENT:'staging',SPREADSHEET_ID:'SYNTHETIC_ONLY'};
  class ClockDate extends Date {constructor(...args){super(...(args.length?args:[control.now]));} static now(){return new Date(control.now).getTime();}}
  const sheet = name => {
    if (!(name in data)) return null;
    return {
      getDataRange(){return {getValues(){stats.reads.push(name);if(control.failRead)throw new Error('SYNTHETIC_READ_FAILURE');return data[name].map(row=>row.slice());}};},
      appendRow(row){
        if(name!=='RSVP'||!stats.locked)throw new Error('Unauthorized test write');
        if(control.failWrite)throw new Error('SYNTHETIC_WRITE_FAILURE');
        stats.writes.push({name,row:row.slice()});
        // Emulate documented Sheets quote-prefix semantics. Real service smoke test remains required.
        data[name].push(row.map(value=>typeof value==='string'&&value.startsWith("'")?value.slice(1):value));
        if(control.loseWriteResponse){control.loseWriteResponse=false;throw new Error('SYNTHETIC_LOST_ACK');}
      }
    };
  };
  const spreadsheet = {getSheetByName:sheet};
  const context = vm.createContext({
    Date:ClockDate, Set, Object, String, Number, JSON, Math, Array, Error,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]})},
    SpreadsheetApp:{openById:id=>{if(id!=='SYNTHETIC_ONLY')throw new Error('NO_REAL_SHEET_ACCESS');return spreadsheet;}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})},
    LockService:{getScriptLock:()=>({tryLock(){if(control.onLock)control.onLock();if(!control.lockAvailable)return false;stats.locked=true;return true;},releaseLock(){stats.locked=false;}})},
    Utilities:{getUuid:randomUUID,formatDate:(date,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
  });
  vm.runInContext(readFileSync(new URL('../apps-script.gs',import.meta.url),'utf8'),context);
  const post = request => {
    stats.requests.push(request.action);
    return JSON.parse(context.doPost({postData:{contents:JSON.stringify(request)}}));
  };
  function setCell(name,row,key,value){data[name][row][data[name][0].indexOf(key)]=value;}
  function setSetting(key,value){const row=data.Settings.find(row=>row[0]===key);if(row)row[1]=value;else data.Settings.push([key,value]);}
  return {context,post,data,stats,control,properties,spreadsheet,setCell,setSetting};
}

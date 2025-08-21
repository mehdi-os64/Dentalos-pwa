// js/backup.js
import { sb, loadTables, readAll } from './db.js';

function ts(){ return new Date().toISOString().replace(/[:.]/g,'-'); }

export async function collectAll(){
  const out={}, tables=await loadTables();
  for(const t of tables) out[t]=await readAll(t);
  return out;
}
export async function downloadBackup(){
  const data = await collectAll();
  const blob = new Blob([JSON.stringify({ exported_at:new Date().toISOString(), data },null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`DentalOS-backup-${ts()}.json`; a.click();
}
export async function uploadBackup(){
  const data = await collectAll();
  const blob = new Blob([JSON.stringify({ exported_at:new Date().toISOString(), data })],{type:'application/json'});
  await sb.storage.from('backups').upload(`json/DentalOS-${ts()}.json`, blob, { upsert:true, contentType:'application/json' });
  return true;
}
export async function restoreFromFile(file, upsertFn){
  const txt = await file.text(); const obj = JSON.parse(txt);
  if(!obj?.data) return false;
  for(const [t,rows] of Object.entries(obj.data||{})){
    if(Array.isArray(rows) && rows.length) await upsertFn(t, rows);
  }
  return true;
}

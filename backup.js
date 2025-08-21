/* DentalOS Backup Manager: Local (IndexedDB) + optional Cloud */
const DB_NAME='dentalos', DB_VER=1, STORE='records';
const CLOUD_ENDPOINT=''; // اگر بعداً نتلیفای/سوپابیس تنظیم کردی اینجا بگذار
const CLOUD_TOKEN='';

function openDB(){ return new Promise((ok,err)=>{ const r=indexedDB.open(DB_NAME,DB_VER);
  r.onupgradeneeded=()=>{const db=r.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});};
  r.onsuccess=()=>ok(r.result); r.onerror=()=>err(r.error); }); }

export async function saveRecord(type,payload){ const db=await openDB(); const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).add({type,payload,ts:Date.now()}); await new Promise(r=>tx.oncomplete=r); db.close(); }
export async function exportBackupJSON(){ const db=await openDB(); const tx=db.transaction(STORE,'readonly'); const st=tx.objectStore(STORE); const all=[]; st.openCursor().onsuccess=e=>{const c=e.target.result; if(c){all.push(c.value); c.continue();}}; await new Promise(r=>tx.oncomplete=r); db.close(); return {exportedAt:new Date().toISOString(),data:all}; }
export async function downloadBackup(){ const json=await exportBackupJSON(); const b=new Blob([JSON.stringify(json)],{type:'application/json'}); const a=document.createElement('a'); const ts=new Date().toISOString().replace(/[:.]/g,'-'); a.href=URL.createObjectURL(b); a.download=`dentalos-backup-${ts}.json`; a.click(); URL.revokeObjectURL(a.href); }
export async function uploadBackupToCloud(){ if(!CLOUD_ENDPOINT) return {ok:false,reason:'No cloud endpoint'}; const json=await exportBackupJSON(); const res=await fetch(CLOUD_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',...(CLOUD_TOKEN?{'Authorization':`Bearer ${CLOUD_TOKEN}`}:{})},body:JSON.stringify(json)}); let body={}; try{body=await res.json();}catch{} return {ok:res.ok,status:res.status,body}; }
export async function restoreFromFile(file){ const text=await file.text(); const parsed=JSON.parse(text); const db=await openDB(); const tx=db.transaction(STORE,'readwrite'); const st=tx.objectStore(STORE); await new Promise(res=>{const q=st.clear(); q.onsuccess=res; q.onerror=res;}); for(const row of (parsed.data||[])) st.add(row); await new Promise(r=>tx.oncomplete=r); db.close(); return true; }
export function scheduleAutoBackup(){ const doBackup=async()=>{ try{ if(navigator.onLine && CLOUD_ENDPOINT){ await uploadBackupToCloud(); } else{ const last=Number(localStorage.getItem('lastLocalBackup')||0); if(Date.now()-last>6*60*60*1000){ await downloadBackup(); localStorage.setItem('lastLocalBackup',String(Date.now())); } } }catch(e){} }; setInterval(doBackup,15*60*1000); document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') doBackup(); }); }
scheduleAutoBackup();

// js/db.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const sb = createClient(
  'https://poubooxbvvzbwyjlfmaj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdWJvb3hidnZ6Ynd5amxmbWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDgxODUsImV4cCI6MjA3MTMyNDE4NX0.aaLn3sqzRr87zFegPqJyrrsbLrK5IF9JpdDjezpsTrQ'
);

/* Event Bus ساده */
const bus = new EventTarget();
export const on   = (name, cb)=> bus.addEventListener(name, e=>cb(e.detail));
export const emit = (name, detail)=> bus.dispatchEvent(new CustomEvent(name,{detail}));

/* IndexedDB */
const DB_NAME='DentalOS.DB', STORE_KV='kv', STORE_Q='queue';
const openIDB=()=>new Promise((res,rej)=>{
  const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>{const db=r.result;
    if(!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
    if(!db.objectStoreNames.contains(STORE_Q))  db.createObjectStore(STORE_Q,{keyPath:'id'});
  };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
});
const kvGet=async k=>new Promise(async(res,rej)=>{const db=await openIDB();const tx=db.transaction(STORE_KV,'readonly');const s=tx.objectStore(STORE_KV);const g=s.get(k);g.onsuccess=()=>res(g.result);g.onerror=()=>rej(g.error);});
const kvSet=async (k,v)=>new Promise(async(res,rej)=>{const db=await openIDB();const tx=db.transaction(STORE_KV,'readwrite');const s=tx.objectStore(STORE_KV);const p=s.put(v,k);p.onsuccess=()=>res(true);p.onerror=()=>rej(p.error);});
const queueAll=async ()=>new Promise(async(res)=>{const db=await openIDB();const out=[];const tx=db.transaction(STORE_Q,'readonly');tx.objectStore(STORE_Q).openCursor().onsuccess=e=>{const c=e.target.result;if(c){out.push(c.value);c.continue();}else res(out)}});
const queuePush=async it=>new Promise(async(res)=>{const db=await openIDB();it.id=it.id||crypto.randomUUID();const tx=db.transaction(STORE_Q,'readwrite');tx.objectStore(STORE_Q).put(it).onsuccess=()=>res(true)});
const queueClear=async ids=>{if(!ids?.length)return;const db=await openIDB();await Promise.all(ids.map(id=>new Promise(r=>{const tx=db.transaction(STORE_Q,'readwrite');tx.objectStore(STORE_Q).delete(id).onsuccess=()=>r(true);})));};

/* کل جداول + کلیدهای اصلی */
const KEY_TABLES='DOS.TABLES', KEY_PK='DOS.PK.';
const DATA_PREFIX='DOS.DATA.';
const kData=t=>DATA_PREFIX+t;

export async function loadTables(){
  if(navigator.onLine){
    const { data, error } = await sb.from('app_tables').select('table_name');
    if(!error && data){ const tables=data.map(x=>x.table_name).sort(); await kvSet(KEY_TABLES,tables); return tables; }
  }
  return (await kvGet(KEY_TABLES))||[];
}
const pkCache={};
export async function getPK(t){
  if(pkCache[t]) return pkCache[t];
  if(navigator.onLine){
    const { data } = await sb.from('table_pks').select('pk_cols').eq('table_name',t).maybeSingle();
    if(data?.pk_cols){ pkCache[t]=data.pk_cols; await kvSet(KEY_PK+t,data.pk_cols); return data.pk_cols; }
  }
  const fb=(await kvGet(KEY_PK+t))||['id'];
  pkCache[t]=fb; return fb;
}

/* کش/همگام‌سازی */
export async function refreshTable(t){
  if(!navigator.onLine) return (await kvGet(kData(t)))||[];
  const { data, error } = await sb.from(t).select('*');
  if(!error && data){ await kvSet(kData(t),data); emit('db:updated',{table:t,full:true}); return data; }
  return (await kvGet(kData(t)))||[];
}
export async function refreshAllTables(){
  const tables=await loadTables();
  for(const t of tables) await refreshTable(t);
  return tables;
}
export async function readAll(t){ return (await kvGet(kData(t)))||[]; }

/* Upsert/Delete برای همهٔ جدول‌ها (حتی PK مرکب) + صف آفلاین */
export async function upsert(t, rows){
  const list = Array.isArray(rows)?rows:[rows];
  if(navigator.onLine){
    const onConflict = (await getPK(t)).join(',');
    const { error } = await sb.from(t).upsert(list, { onConflict });
    if(error){ await queuePush({op:'upsert',table:t,rows:list}); throw error; }
    await refreshTable(t); return true;
  }else{
    await queuePush({op:'upsert',table:t,rows:list});
    // به‌روز کردن کش محلی برای حس بلادرنگ
    const cur = await readAll(t);
    const pk = await getPK(t);
    for(const r of list){
      const idx = cur.findIndex(row=> pk.every(k=>row[k]===r[k]));
      if(idx>-1) cur[idx]={...cur[idx],...r}; else cur.unshift(r);
    }
    await kvSet(kData(t),cur);
    emit('db:updated',{table:t,full:false});
    return true;
  }
}
export async function removeByPK(t, where){
  const list = Array.isArray(where)?where:[where];
  if(navigator.onLine){
    let q = sb.from(t).delete();
    for(const k of Object.keys(list[0])) q=q.eq(k,list[0][k]);
    const { error } = await q;
    if(error){ await queuePush({op:'delete',table:t,where:list}); throw error; }
    await refreshTable(t); return true;
  }else{
    await queuePush({op:'delete',table:t,where:list});
    const cur = await readAll(t);
    const pk  = await getPK(t);
    const filtered = cur.filter(row=> !list.some(w=> pk.every(k=>row[k]===w[k])));
    await kvSet(kData(t),filtered);
    emit('db:updated',{table:t,full:false});
    return true;
  }
}

/* تخلیه صف آفلاین هنگام آنلاین شدن */
export async function flushQueue(){
  if(!navigator.onLine) return false;
  const jobs = await queueAll(); if(jobs.length===0) return true;
  const doneIds=[];
  for(const j of jobs){
    try{
      if(j.op==='upsert'){
        const onConflict = (await getPK(j.table)).join(',');
        const { error } = await sb.from(j.table).upsert(j.rows,{ onConflict });
        if(error) throw error;
      }else if(j.op==='delete'){
        for(const w of j.where){
          let q = sb.from(j.table).delete();
          for(const k of Object.keys(w)) q=q.eq(k,w[k]);
          const { error } = await q; if(error) throw error;
        }
      }
      doneIds.push(j.id);
    }catch(e){
      // اگر خطا خورد، توقف (برای حفظ ترتیب)
      break;
    }
  }
  await queueClear(doneIds);
  // پس از تخلیه، همهٔ جدول‌ها را تازه کن
  await refreshAllTables();
  return true;
}

/* وضعیت شبکه برای نقطه‌ی سبز/قرمز */
export const online = ()=> navigator.onLine;
window.addEventListener('online', ()=>{ flushQueue(); emit('net',{online:true}); });
window.addEventListener('offline',()=>{ emit('net',{online:false}); });

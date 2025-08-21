/* js/db.js — DentalOS core (Offline/Online + Queue + Sync) */

/* 1) تنظیمات Supabase */
const SUPABASE_URL = 'https://poubooxbvvzbwyjlfmaj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdWJvb3hidnZ6Ynd5amxmbWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDgxODUsImV4cCI6MjA3MTMyNDE4NX0.aaLn3sqzRr87zFegPqJyrrsbLrK5IF9JpdDjezpsTrQ';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: { fetch: (...a) => fetch(...a) }
});

/* 2) ابزارهای کوچک */
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
const uid = ()=> (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));

/* 3) IndexedDB مینیمال (یک DB برای همه‌ی جدول‌ها + صف) */
const IDB_NAME = 'DOS.IDB.v1';
let _idb;

/* بازکردن DB و ساخت استورها در صورت نیاز */
async function openIDB(stores){
  if(_idb) return _idb;
  _idb = await new Promise((resolve,reject)=>{
    const req = indexedDB.open(IDB_NAME, 3);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      // استور صف
      if(!db.objectStoreNames.contains('queue')){
        db.createObjectStore('queue',{ keyPath: 'qid' });
      }
      // استور متا
      if(!db.objectStoreNames.contains('meta')){
        db.createObjectStore('meta',{ keyPath: 'key' });
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  // در لحظه نام جدول جدید دیدیم، استور کشش را بسازیم
  if(stores?.length){ await ensureStores(stores); }
  return _idb;
}

async function ensureStores(tables){
  const db = await openIDB();
  const need = tables.filter(t=>!db.objectStoreNames.contains('cache:'+t));
  if(!need.length) return;
  db.close();
  const ver = (await new Promise(r=>{
    const req = indexedDB.open(IDB_NAME);
    req.onsuccess = ()=>{ const v=req.result.version; req.result.close(); r(v); };
  })) + 1;
  await new Promise((resolve,reject)=>{
    const req = indexedDB.open(IDB_NAME, ver);
    req.onupgradeneeded = ()=>{
      const db2 = req.result;
      need.forEach(t=>{
        db2.createObjectStore('cache:'+t, { keyPath: 'id' });
      });
    };
    req.onsuccess = ()=>{ _idb=req.result; resolve(); };
    req.onerror = ()=> reject(req.error);
  });
}

/* کمک‌متدهای عمومی روی IDB */
async function idbAll(store){
  const db = await openIDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,'readonly');
    const st = tx.objectStore(store);
    const res = [];
    st.openCursor().onsuccess = (e)=>{
      const cur = e.target.result;
      if(cur){ res.push(cur.value); cur.continue(); } else resolve(res);
    };
    tx.onerror = ()=> reject(tx.error);
  });
}
async function idbPut(store, obj){
  const db = await openIDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).put(obj);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}
async function idbBulkPut(store, rows){
  const db = await openIDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,'readwrite');
    const st = tx.objectStore(store);
    rows.forEach(r=> st.put(r));
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}
async function idbDelete(store, key){
  const db = await openIDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(store,'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}

/* 4) لیست جدول‌ها (سراسری و پویا) */
const DEFAULT_TABLES = [
  'patients','appointments','visits','prices','inventory',
  'doctors','payments','expenses','settings'
];

/**
 * loadTables()
 * - اگر RPC به نام dos_list_tables داشته باشی، از آن می‌خواند
 * - اگر جدول/ویوی _tables داشته باشی (ستون name)، از آن می‌خواند
 * - در غیر این صورت به لیست پیش‌فرض برمی‌گردد
 */
export async function loadTables(){
  // سعی: RPC
  try{
    const { data, error } = await sb.rpc('dos_list_tables');
    if(!error && Array.isArray(data) && data.length){
      const list = data.map(x=> (x.name || x.table_name || x)).filter(Boolean);
      await ensureStores(list);
      return list;
    }
  }catch(_){}

  // سعی: جدول متا
  try{
    const { data, error } = await sb.from('_tables').select('name');
    if(!error && Array.isArray(data) && data.length){
      const list = data.map(x=> x.name).filter(Boolean);
      await ensureStores(list);
      return list;
    }
  }catch(_){}

  await ensureStores(DEFAULT_TABLES);
  return DEFAULT_TABLES;
}

/* 5) خواندن کل داده‌های یک جدول (اولویت با آنلاین، بعد کش) */
export async function readAll(table){
  await ensureStores([table]);
  const cacheStore = 'cache:'+table;

  if (navigator.onLine){
    const { data, error } = await sb.from(table).select('*').order('updated_at', { ascending: true }).limit(10000);
    if(!error && Array.isArray(data)){
      // کش را هم آپدیت کن
      await idbBulkPut(cacheStore, data.map(x=> ({...x, id: x.id ?? uid()})));
      return data;
    }
  }
  // آفلاین یا خطا: از کش
  return await idbAll(cacheStore);
}

/* 6) صف آفلاین (queue) */
async function queuePush(item){
  await idbPut('queue', { qid: uid(), ...item, ts: Date.now() });
}
async function queueAll(){
  return await idbAll('queue');
}
async function queueDelete(qid){
  await idbDelete('queue', qid);
}

/* 7) عملیات عمومی (Upsert/Delete) با آفلاین/آنلاین و Sync */
export async function upsertRow(table, row){
  await ensureStores([table]);
  const cacheStore = 'cache:'+table;
  const id = row.id || uid();
  const withId = { ...row, id };

  // بلافاصله UI/کش را به‌روز کن
  await idbPut(cacheStore, withId);

  if (navigator.onLine){
    const { error } = await sb.from(table).upsert(withId).select('id').single();
    if(!error){ return { ok:true, id }; }
  }
  // اگر آفلاین یا خطا: به صف
  await queuePush({ type:'upsert', table, payload: withId });
  return { ok:true, queued:true, id };
}

export async function deleteRow(table, id){
  await ensureStores([table]);
  const cacheStore = 'cache:'+table;
  // کش را هم حذف کن
  await idbDelete(cacheStore, id);

  if (navigator.onLine){
    const { error } = await sb.from(table).delete().eq('id', id);
    if(!error){ return { ok:true }; }
  }
  // صف معوقه
  await queuePush({ type:'delete', table, payload: { id } });
  return { ok:true, queued:true };
}

/* 8) درج گروهی (برای ریستور) */
export async function bulkInsert(table, rows, upsert=true){
  await ensureStores([table]);
  const cacheStore = 'cache:'+table;
  // کش محلی
  await idbBulkPut(cacheStore, rows.map(r=> ({...r, id: r.id || uid()})));

  if (navigator.onLine){
    const { error } = await sb.from(table)[upsert ? 'upsert' : 'insert'](rows);
    if(!error) return { ok:true };
  }
  // اگر نشد، همه را صف کن
  for(const r of rows){
    await queuePush({ type:'upsert', table, payload: { ...r, id: r.id || uid() } });
  }
  return { ok:true, queued:true };
}

/* 9) همگام‌سازی صف (وقتی آنلاین شد) */
export async function syncPending(toastMsg=true){
  if(!navigator.onLine) return { ok:false, offline:true };

  const items = await queueAll();
  for(const q of items){
    try{
      if(q.type === 'upsert'){
        const { error } = await sb.from(q.table).upsert(q.payload);
        if(!error) await queueDelete(q.qid);
      }else if(q.type === 'delete'){
        const { error } = await sb.from(q.table).delete().eq('id', q.payload.id);
        if(!error) await queueDelete(q.qid);
      }
      // وقفه کوتاه تا فشار نیاید
      await sleep(60);
    }catch(e){ console.error(e); }
  }
  if(toastMsg && typeof window.toast==='function'){
    window.toast('🔄 همگام‌سازی معوقه انجام شد');
  }
  return { ok:true, processed: items.length };
}

/* 10) نشان وضعیت آنلاین/آفلاین + تریگر Sync خودکار */
function updateOnlineBadge(){
  const dot = document.getElementById('net');
  if(!dot) return;
  dot.classList.toggle('online', navigator.onLine);
}
window.addEventListener('online', async ()=>{
  updateOnlineBadge();
  await syncPending(true);
});
window.addEventListener('offline', updateOnlineBadge);
updateOnlineBadge();

/* 11) اکسپورت‌های کمکی برای UI دیگر فایل‌ها */
export async function readAllTables(){
  const names = await loadTables();
  const out = {};
  for(const t of names){
    out[t] = await readAll(t);
  }
  return out;
}

/* 12) بارگیری اولیه و Sync اولیه (اختیاری) */
(async ()=>{
  try{
    const tables = await loadTables();
    // کش اولیه (سایلنت)
    for(const t of tables){
      await readAll(t);
    }
    // اگر چیزی در صف مانده، تلاش برای ارسال
    if(navigator.onLine){ await syncPending(false); }
  }catch(e){ console.error(e); }
})();

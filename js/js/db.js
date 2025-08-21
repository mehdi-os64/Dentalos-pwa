/* js/db.js */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SB_URL = "https://poubooxbvvzbwyjlfmaj.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdWJvb3hidnZ6Ynd5amxmbWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NDgxODUsImV4cCI6MjA3MTMyNDE4NX0.aaLn3sqzRr87zFegPqJyrrsbLrK5IF9JpdDjezpsTrQ";
export const sb = createClient(SB_URL, SB_KEY);

// کلیدهای ذخیره‌ی محلی
const KEY_APPTS  = 'DOS.APPOINTMENTS';
const KEY_PRICES = 'DOS.PRICES';
const KEY_QUEUE  = 'DOS.PENDING_QUEUE';

// ابزار ذخیره محلی ساده
const LDB = {
  get: async (k)=> JSON.parse(localStorage.getItem(k)||'null'),
  set: async (k,v)=> localStorage.setItem(k, JSON.stringify(v)),
};

// صف آفلاین
const Queue = {
  async all(){ return (await LDB.get(KEY_QUEUE)) || []; },
  async push(op){ const q = await this.all(); q.push({...op, ts: Date.now()}); await LDB.set(KEY_QUEUE, q); },
  async clear(){ await LDB.set(KEY_QUEUE, []); }
};

// Toast عمومی
function toast(msg){
  const el = document.getElementById('toast'); if(!el) return;
  el.textContent = msg; el.style.display='block';
  clearTimeout(window.__t); window.__t = setTimeout(()=> el.style.display='none', 2500);
}
window.toast = toast;

// توابع دیتابیس
export const DB = {};

// --- قیمت‌ها ---
DB.addPrice = async function(obj){
  if(!obj?.title || !obj?.amount){ toast('نام/قیمت معتبر نیست'); return; }

  if(navigator.onLine){
    const { error } = await sb.from('prices').insert({ title: obj.title, amount: obj.amount });
    if(error){ await Queue.push({t:'insert', table:'prices', data: obj}); toast('خطا! در صف قرار گرفت'); }
  }else{
    await Queue.push({t:'insert', table:'prices', data: obj});
    toast('آفلاین هستید؛ در صف ذخیره شد');
  }
  const cur = (await LDB.get(KEY_PRICES)) || [];
  cur.unshift({ id: 'local-'+Date.now(), ...obj });
  await LDB.set(KEY_PRICES, cur);
  if(window.renderPrices) window.renderPrices(cur);
};

DB.fetchPrices = async function(){
  if(navigator.onLine){
    const { data, error } = await sb.from('prices').select('*').order('id', { ascending:false });
    if(!error && data){ await LDB.set(KEY_PRICES, data); }
  }
  return (await LDB.get(KEY_PRICES)) || [];
};

// --- نوبت‌ها ---
DB.addAppointment = async function(obj){
  if(!obj?.patient || !obj?.time){ toast('نام بیمار/زمان الزامی است'); return; }

  if(navigator.onLine){
    const { error } = await sb.from('appointments').insert({
      patient: obj.patient, doctor: obj.doctor, time: obj.time, note: obj.note
    });
    if(error){ await Queue.push({t:'insert', table:'appointments', data: obj}); toast('خطا! در صف قرار گرفت'); }
  }else{
    await Queue.push({t:'insert', table:'appointments', data: obj});
    toast('آفلاین هستید؛ در صف ذخیره شد');
  }
  const cur = (await LDB.get(KEY_APPTS)) || [];
  cur.unshift({ id:'local-'+Date.now(), ...obj });
  await LDB.set(KEY_APPTS, cur);
  if(window.renderAppointments) window.renderAppointments(cur);
};

DB.fetchAppointments = async function(){
  if(navigator.onLine){
    const { data, error } = await sb.from('appointments').select('*').order('time', { ascending:true });
    if(!error && data){ await LDB.set(KEY_APPTS, data); }
  }
  return (await LDB.get(KEY_APPTS)) || [];
};

// همگام‌سازی صف آفلاین
DB.syncPending = async function(showToast=false){
  if(!navigator.onLine){ if(showToast) toast('همگام‌سازی: هنوز آفلاینید'); return; }
  const q = await Queue.all();
  if(!q.length){ if(showToast) toast('چیزی برای ارسال نیست'); return; }

  for(const op of q){
    try{
      if(op.table==='prices' && op.t==='insert'){
        await sb.from('prices').insert({ title: op.data.title, amount: op.data.amount });
      }
      if(op.table==='appointments' && op.t==='insert'){
        await sb.from('appointments').insert({
          patient: op.data.patient, doctor: op.data.doctor, time: op.data.time, note: op.data.note
        });
      }
    }catch(e){}
  }
  await Queue.clear();
  if(showToast) toast('همگام‌سازی معوقه انجام شد');
  // تازه‌سازی کش محلی
  if(window.renderPrices) window.renderPrices(await DB.fetchPrices());
  if(window.renderAppointments) window.renderAppointments(await DB.fetchAppointments());
};

// بارگیری اولیه + ارسال معوقه در شروع
(async ()=>{
  if(window.renderPrices) window.renderPrices(await DB.fetchPrices());
  if(window.renderAppointments) window.renderAppointments(await DB.fetchAppointments());
  window.addEventListener('online', ()=> DB.syncPending(true));
})();

/* js/realtime.js
 * سابسکرایب سراسری Supabase Realtime برای همه‌ی جداول اسکیما public
 * نیازمند: export { sb, DB } از js/db.js
 */

import { sb, DB } from './db.js';

// نوتیفای ساده
function toast(msg){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ el.style.display = 'none'; }, 2500);
}

// نگاشتِ جدول → نام تابع رندر (اختیاری)
const RENDERERS = {
  prices: 'renderPrices',
  appointments: 'renderAppointments',
  patients: 'renderPatients',
  doctors: 'renderDoctors',
  visits: 'renderVisits',
  inventory: 'renderInventory'
  // هر جدول دیگری اضافه شد، اینجا فقط یک خط نامش را بگذار (اختیاری)
};

// وقتی آنلاین/آفلاین شدیم پیام بده
function hookOnlineBadge(){
  const dot = document.getElementById('net');
  const set = ()=>{ if(dot){ dot.classList.toggle('online', navigator.onLine); } };
  window.addEventListener('online',  set);
  window.addEventListener('offline', set);
  set();
}

// یک هندلر مشترک برای هر رویداد پایگاه‌داده
async function onChange(payload){
  try{
    const table = payload?.table;            // نام جدول
    const typ   = payload?.eventType || '';  // نوع رویداد: INSERT/UPDATE/DELETE
    if(!table) return;

    // آخرین داده‌های همان جدول را از سرور می‌گیریم (اگر آنلاین بود)
    // و داخل کش IndexedDB می‌ریزیم؛ اگر آفلاین باشیم، DB.fetch خودش از کش می‌خواند
    await DB.fetch(table);

    // اگر تابع رندر برای این جدول داری، صدا بزن
    const fn = RENDERERS[table];
    if(fn && typeof window[fn] === 'function'){
      window[fn]();                           // رفرش UI همان بخش
    }else if(typeof window.render === 'function'){
      window.render(table);                   // رندرر کلی (در صورت وجود)
    }

    // پیام کاربرپسند
    const faEvt = typ === 'INSERT' ? 'افزوده شد'
                : typ === 'UPDATE' ? 'ویرایش شد'
                : typ === 'DELETE' ? 'حذف شد'
                : 'بروزرسانی شد';
    toast(`«${table}» ${faEvt} 🔄`);

  }catch(err){
    console.error('[Realtime] handler error:', err);
  }
}

// شروع سابسکرایب سراسری
function start(){
  hookOnlineBadge();

  // کانال Realtime برای تمام جداول اسکیما public (همه‌ی رویدادها)
  const ch = sb.channel('rt:all')
    .on('postgres_changes', { event: '*', schema: 'public' }, onChange)
    .subscribe((status) => {
      // وضعیت عضویت در کانال (SUBSCRIBED | CLOSED | TIMED_OUT)
      if(status === 'SUBSCRIBED'){
        console.log('[Realtime] Subscribed to all tables in schema public');
        toast('اتصال همزمان برقرار شد ✅');
      }else if(status === 'CLOSED'){
        console.warn('[Realtime] Channel closed');
      }else if(status === 'TIMED_OUT'){
        console.warn('[Realtime] Channel timeout');
      }
    });
  
  // اگر لازم شد بعداً ببندی:
  window.closeRealtime = ()=> sb.removeChannel(ch);
}

// به صورت خودکار استارت بزن
start();

// اگر جایی لازم شد دستی فراخوانی کنی:
window.Realtime = { start };

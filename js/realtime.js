/* js/realtime.js */
import { sb } from './db.js';

function toast(msg){
  const el = document.getElementById('toast'); if(!el) return;
  el.textContent = msg; el.style.display='block';
  clearTimeout(window.__t); window.__t = setTimeout(()=> el.style.display='none', 2000);
}

const Realtime = {
  start(){
    // appointments
    sb.channel('rt:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async ()=>{
        if(window.renderAppointments){
          const { DB } = await import('./db.js');
          window.renderAppointments(await DB.fetchAppointments());
        }
        toast('نوبت‌ها آپدیت شد 🔄');
      })
      .subscribe();

    // prices
    sb.channel('rt:prices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prices' }, async ()=>{
        if(window.renderPrices){
          const { DB } = await import('./db.js');
          window.renderPrices(await DB.fetchPrices());
        }
        toast('لیست قیمت آپدیت شد 🔄');
      })
      .subscribe();
  }
};

Realtime.start();

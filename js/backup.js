/* js/backup.js */
import { sb } from './db.js';
import { DB } from './db.js';

const BACKUP_KEY_LOCAL = 'DOS.BACKUP_LAST_JSON';

async function collectAllData(){
  const appts = await DB.fetchAppointments();
  const prices = await DB.fetchPrices();
  return { exportedAt: new Date().toISOString(), appts, prices };
}

async function backupLocal(j){
  localStorage.setItem(BACKUP_KEY_LOCAL, JSON.stringify(j));
}

async function backupCloud(j){
  const blob = new Blob([JSON.stringify(j,null,2)], {type:'application/json'});
  const ymd = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); // YYYY-MM-DD-hh-mm-ss
  const path = `full/${ymd}.json`;
  const { error } = await sb.storage.from('backups').upload(path, blob, { contentType:'application/json', upsert:false });
  if(error) throw error;
  return path;
}

async function backupNow(){
  const data = await collectAllData();
  await backupLocal(data);
  if(navigator.onLine){
    try{
      const path = await backupCloud(data);
      window.toast?.('بک‌آپ در فضای ابری ذخیره شد ✓');
      console.log('backup path:', path);
    }catch(e){ window.toast?.('بک‌آپ ابری ناموفق، محلی ذخیره شد'); }
  }else{
    window.toast?.('آفلاین: بک‌آپ فقط محلی ذخیره شد');
  }
}

window.backupNow = backupNow;

// دکمه‌ی «بک‌آپ فوری» در index.html
document.getElementById('btnBackup')?.addEventListener('click', backupNow);

// زمان‌بندی خودکار: هر ۶ ساعت
setInterval(()=> backupNow().catch(()=>{}), 6*60*60*1000);

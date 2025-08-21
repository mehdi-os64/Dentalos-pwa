// js/backup.js
import { sb, loadTables, readAll, bulkInsert } from './db.js';

// زمان فعلی
function ts(){ return new Date().toISOString().replace(/[:.]/g,'-'); }

/**
 * جمع‌آوری کل داده‌ها از همه‌ی جداول
 */
export async function collectAll(){
  const out = {};
  const tables = await loadTables(); // همه‌ی جدول‌های تعریف شده
  for(const t of tables){
    out[t] = await readAll(t); // داده‌های هر جدول
  }
  return out;
}

/**
 * دانلود بکاپ به صورت فایل JSON (برای کاربر)
 */
export async function downloadBackup(){
  const data = await collectAll();
  const blob = new Blob([JSON.stringify({data, ts: ts()}, null, 2)], {type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`backup_${ts()}.json`;
  a.click();
  toast("⬇️ فایل بکاپ دانلود شد");
  return true;
}

/**
 * آپلود بکاپ به Supabase Storage (پوشه backups)
 */
export async function uploadBackup(){
  const data = await collectAll();
  const blob = new Blob([JSON.stringify({data, ts: ts()}, null, 2)], {type:'application/json'});
  const filename = `json/backup_${ts()}.json`;

  const { error } = await sb.storage.from('backups').upload(filename, blob, { upsert: true });
  if(error){
    console.error(error);
    toast("❌ خطا در آپلود بکاپ");
    return false;
  }
  toast("☁️ بکاپ ابری ذخیره شد");
  return true;
}

/**
 * ریستور از فایل JSON
 */
export async function restoreFromFile(file, upsert=true){
  try{
    const txt = await file.text();
    const obj = JSON.parse(txt);
    if(!obj?.data) return false;

    // پر کردن مجدد همه‌ی جدول‌ها
    for(const [t, rows] of Object.entries(obj.data || {})){
      if(Array.isArray(rows) && rows.length){
        await bulkInsert(t, rows, upsert);
      }
    }
    toast("♻️ ریستور کامل شد");
    return true;
  }catch(e){
    console.error(e);
    toast("❌ خطا در ریستور");
    return false;
  }
}

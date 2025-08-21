// js/ui.js
import { on, online, refreshAllTables, flushQueue, upsert, removeByPK, getPK } from './db.js';
import { uploadBackup, restoreFromFile } from './backup.js';

/* Toast + وضعیت شبکه */
const dot = document.getElementById('net');
const toast = (msg)=>{ const el=document.getElementById('toast'); if(!el) return; el.textContent=msg; el.style.display='block'; clearTimeout(window.__t); window.__t=setTimeout(()=>el.style.display='none',2200); };
const paintNet = ()=>{ if(!dot) return; dot.classList.toggle('online', online()); };
paintNet();
on('net', paintNet);

/* بوت اولیه */
await refreshAllTables();
await flushQueue();

/* بکاپ ابری خودکار هر ۱۲ ساعت */
setInterval(uploadBackup, 12*60*60*1000);

/* ===== اتوبایندر فرم‌ها ===== */
function valCast(v){ if(v===''||v==null) return null; if(!isNaN(v) && (String(v).trim()!=='')) return Number(v); return v; }
function formRow(form){
  const row={};
  form.querySelectorAll('input[name],textarea[name],select[name]').forEach(el=>{
    const name=el.name; let v = (el.type==='checkbox') ? el.checked : el.value;
    row[name] = valCast(String(v));
  });
  return row;
}
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

async function bindForm(form){
  const table = form.dataset.table; if(!table) return;
  const pk    = await getPK(table);
  const autosave = form.dataset.autosave==='true';

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const row=formRow(form);
    if(pk.length===1 && !(pk[0] in row)) row[pk[0]] = crypto.randomUUID();
    await upsert(table, row);
    toast('✅ ذخیره شد');
  });

  if(autosave){
    const saveNow = debounce(async ()=>{
      const row=formRow(form);
      if(pk.length===1 && !(pk[0] in row)) row[pk[0]] = crypto.randomUUID();
      await upsert(table,row);
    }, 600);
    form.addEventListener('input', saveNow);
    form.addEventListener('change', saveNow);
  }

  on('db:change', async ({table:tbl,new:rec})=>{
    if(tbl!==table || !rec) return;
    const cur=formRow(form);
    const same = pk.every(k=> (cur[k]??null)=== (rec[k]??null));
    if(!same) return;
    form.querySelectorAll('input[name],textarea[name],select[name]').forEach(el=>{
      const name=el.name;
      if(rec[name]===undefined) return;
      if(el.type==='checkbox') el.checked = !!rec[name];
      else el.value = rec[name] ?? '';
    });
    toast('🔄 با تغییرات سایر دستگاه‌ها تازه شد');
  });

  form.querySelectorAll('[data-delete="true"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const where={};
      pk.forEach(k=>{
        const v = btn.getAttribute('data-pk_'+k) ?? form.querySelector(`[name="${k}"]`)?.value;
        where[k] = v;
      });
      await removeByPK(table, where);
      toast('🗑️ حذف شد');
    });
  });
}

document.querySelectorAll('form[data-table]').forEach(bindForm);

/* ریستور از فایل بکاپ (اختیاری: دکمه‌ای بساز که input[file] را تریگر کند) */
document.querySelectorAll('[data-restore-input]').forEach(btn=>{
  const input = document.querySelector(btn.getAttribute('data-restore-input'));
  if(!input) return;
  btn.addEventListener('click', ()=> input.click());
  input.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    const ok = await restoreFromFile(file, upsert);
    if(ok){ await refreshAllTables(); toast('♻️ ریستور شد'); }
  });
});

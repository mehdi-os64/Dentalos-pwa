// js/realtime.js
import { sb, loadTables, refreshTable, emit } from './db.js';

export async function startRealtime(){
  const tables = await loadTables();
  for(const t of tables){
    sb.channel(`rt:${t}`)
      .on('postgres_changes',{event:'*',schema:'public',table:t}, async (payload)=>{
        // کش جدول را تازه کن
        await refreshTable(t);
        // رویداد دقیق رکورد (new/old) برای UIهای فرمی
        emit('db:change', { table:t, type:payload.eventType, new:payload.new, old:payload.old });
      })
      .subscribe();
  }
}
startRealtime();

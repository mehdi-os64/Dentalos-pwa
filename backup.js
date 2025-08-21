// این فایل توابعی برای خروجی‌گرفتن داده‌ها و بازیابی آن‌ها تعریف می‌کند.
// برای استفاده، دکمه یا رویداد مناسب ایجاد کنید و سپس exportBackup() یا importBackup(file) را فراخوانی کنید.
(async ()=>{
  // خروجی گرفتن قیمت‌ها به فایل JSON
  window.exportBackup = async function(){
    const { data } = await supabase.from('prices').select();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'prices_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // بازیابی قیمت‌ها از فایل JSON
  window.importBackup = async function(file){
    const text = await file.text();
    const data = JSON.parse(text);
    if(Array.isArray(data)){
      for(const row of data){
        await supabase.from('prices').upsert(row);
      }
    }
  };
})();

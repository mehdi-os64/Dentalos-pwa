/* sw-register.js */
if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try{
      const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      // اگر ورکر جدید آماده شد، سریع فعال شود
      if (reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
      reg.addEventListener('updatefound', ()=>{
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', ()=>{
          if(nw.state==='installed' && navigator.serviceWorker.controller){
            nw.postMessage({type:'SKIP_WAITING'});
            nw.addEventListener('statechange', ()=>{
              if(nw.state==='activated') location.reload();
            });
          }
        });
      });
    }catch(e){ console.warn('SW register error', e); }
  });
}

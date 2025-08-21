// Register Service Worker + auto update via latest.json
(async function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.register('/service-worker.js');

  async function checkUpdate(){
    try{
      const res = await fetch('/latest.json', { cache: 'no-cache' });
      const {version} = await res.json();
      const current = localStorage.getItem('appVersion');
      if(version && version!==current){
        await reg.update();
        if(reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        navigator.serviceWorker.addEventListener('controllerchange', ()=>{
          localStorage.setItem('appVersion', version);
          window.location.reload();
        });
      }
    }catch(_){}
  }
  checkUpdate();
  setInterval(checkUpdate, 30*60*1000);
  if(reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
})();

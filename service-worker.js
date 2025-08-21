// service-worker.js
const CACHE='dos-shell-v1.0.0';
const ASSETS=[
  './','./index.html','./manifest.webmanifest','./latest.json',
  './js/db.js','./js/realtime.js','./js/backup.js','./js/ui.js'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys(); await Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  })()); self.clients.claim();
});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const isHTML = req.headers.get('accept')?.includes('text/html');
  if(isHTML){
    e.respondWith((async()=>{
      try{ const net=await fetch(req); const c=await caches.open(CACHE); c.put(req,net.clone()); return net; }
      catch{ const c=await caches.open(CACHE); return (await c.match(req))||(await c.match('./')); }
    })()); return;
  }
  e.respondWith((async()=>{
    const c=await caches.open(CACHE); const cached=await c.match(req);
    const net=fetch(req).then(res=>{ c.put(req,res.clone()); return res; }).catch(()=>cached);
    return cached||net;
  })());
});

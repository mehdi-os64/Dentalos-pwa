/* DentalOS PWA — Service Worker */
const SW_VERSION = 'v1.0.0';
const CORE_CACHE = `core-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;

const CORE_ASSETS = [
  '/', '/index.html', '/manifest.webmanifest',
  '/icons/tooth-48.png','/icons/tooth-72.png','/icons/tooth-96.png',
  '/icons/tooth-128.png','/icons/tooth-144.png','/icons/tooth-152.png',
  '/icons/tooth-180.png','/icons/tooth-192.png','/icons/tooth-256.png',
  '/icons/tooth-384.png','/icons/tooth-512.png'
];

self.addEventListener('install', (e)=>{ e.waitUntil(caches.open(CORE_CACHE).then(c=>c.addAll(CORE_ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ 
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>(
    (k.startsWith('core-')||k.startsWith('runtime-')) && k!==CORE_CACHE && k!==RUNTIME_CACHE ? caches.delete(k):null
  )))));
  self.clients.claim();
});
self.addEventListener('fetch', (e)=>{
  const req=e.request; if(req.method!=='GET')return;
  const p=new URL(req.url).pathname;
  if(CORE_ASSETS.includes(p)){ e.respondWith(caches.match(req).then(r=>r||fetch(req))); return; }
  e.respondWith((async()=>{
    const cache=await caches.open(RUNTIME_CACHE);
    const cached=await cache.match(req);
    const network=fetch(req).then(res=>{ if(res&&res.status===200&&res.type==='basic') cache.put(req,res.clone()); return res; })
      .catch(()=>cached);
    return cached||network;
  })());
});
self.addEventListener('message',(e)=>{ if(e.data==='SKIP_WAITING') self.skipWaiting(); });

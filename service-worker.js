/* DentalOS PWA – Service Worker */
const CACHE = 'dent-os-v1.0.0';
const APP_ASSETS = [
  '/', '/index.html',
  '/manifest.webmanifest',
  '/icons/tooth-48.png','/icons/tooth-72.png','/icons/tooth-96.png','/icons/tooth-128.png',
  '/icons/tooth-144.png','/icons/tooth-152.png','/icons/tooth-180.png','/icons/tooth-192.png',
  '/icons/tooth-256.png','/icons/tooth-384.png','/icons/tooth-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil((async ()=>{
    const names = await caches.keys();
    await Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)));
  })());
  self.clients.claim();
});

self.addEventListener('message', e=>{
  if(e.data && e.data.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e=>{
  const {request} = e;
  if(request.method !== 'GET') return;

  const url = new URL(request.url);
  const isHTML = request.headers.get('accept')?.includes('text/html');

  // برای صفحات: Network-First با بازگشت به کش
  if(isHTML){
    e.respondWith((async ()=>{
      try{
        const res = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, res.clone());
        return res;
      }catch{
        const cache = await caches.open(CACHE);
        return (await cache.match(request)) || cache.match('/index.html');
      }
    })());
    return;
  }

  // برای فایل‌های استاتیک همین دامنه: Stale-While-Revalidate
  if(url.origin === location.origin){
    e.respondWith((async ()=>{
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request).then(res=>{ cache.put(request, res.clone()); return res; }).catch(()=>null);
      return cached || network || fetch(request);
    })());
    return;
  }

  // باقی درخواست‌های خارجی: Network-First
  e.respondWith((async ()=>{
    try{ return await fetch(request); }
    catch{
      const cache = await caches.open(CACHE);
      return await cache.match(request) || new Response('',{status:504,statusText:'offline'});
    }
  })());
});

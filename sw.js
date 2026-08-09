const CACHE_NAME = 'workshop-app-v8'; // v8: إصلاح جذري لوضع الاستقبال — نوافذ التأكيد كانت بتقفل من غير مخرج، وزرار حذف العميل كان ممكن يشتغل من قائمة "المزيد"، وزرار سجل العميل رجع ظاهر مباشرة
const CORE_ASSETS = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => { /* تجاهل أي ملف غير متاح وقت التثبيت */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// استراتيجية "الإنترنت أولاً": يحاول ياخد أحدث نسخة من السيرفر دايمًا،
// ولو مفيش إنترنت (أوفلاين) بس وقتها يرجع يستخدم آخر نسخة محفوظة عنده.
// ده عكس الاستراتيجية القديمة اللي كانت بتستخدم الكاش دايمًا حتى لو فيه نسخة أحدث على السيرفر.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ============================================================================
   Service Worker — مزرعة الاستزراع السمكي v3.0
   - تخزين مؤقت ذكي (Cache-First + Network-First)
   - دعم Offline الكامل
   - تحديث تلقائي سلس
   - دعم جميع أنواع الأجهزة (الهاتف والتابلت)
   =========================================================================== */

const CACHE_NAME = 'fish-farm-v3.0';
const RUNTIME_CACHE = 'fish-farm-runtime-v3.0';
const OFFLINE_URL = './index.html';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './sw.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap'
];

/* ============================================================================
   التثبيت — حفظ الأصول الثابتة
   =========================================================================== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('بعض الأصول لم تحفظ في التخزين المؤقت:', err);
          return cache.addAll(STATIC_ASSETS.filter(url => 
            !url.includes('fonts.googleapis.com')
          ));
        });
      })
      .then(() => self.skipWaiting())
  );
});

/* ============================================================================
   التفعيل — حذف الإصدارات القديمة
   =========================================================================== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => 
              cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE
            )
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

/* ============================================================================
   جلب البيانات — استراتيجية ذكية
   =========================================================================== */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الطلبات غير GET
  if (request.method !== 'GET') return;

  // Firebase و APIs الخارجية — Network First (مع fallback للـ Cache)
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cdn.')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const cloned = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, cloned);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((cached) => cached || createOfflineResponse());
        })
    );
    return;
  }

  // الملفات الثابتة — Cache First
  if (
    url.pathname.match(/\.(js|css|png|jpg|gif|svg|woff|woff2|ttf|eot)$/i) ||
    url.pathname === '/' ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('manifest.json')
  ) {
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) return response;
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
            return response;
          })
        )
        .catch(() => createOfflineResponse())
    );
    return;
  }

  // الحد الافتراضي — Network First مع Cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) return response;
        const cloned = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, cloned);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request)
          .then((cached) => cached || createOfflineResponse());
      })
  );
});

/* ============================================================================
   معالجة الرسائل — التحديث السلس
   =========================================================================== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ============================================================================
   إنشاء صفحة offline
   =========================================================================== */
function createOfflineResponse() {
  return caches.match(OFFLINE_URL)
    .then((response) => response || new Response(
      'لا يتوفر اتصال بالإنترنت. يعمل التطبيق بصيغة محدودة.',
      { status: 503, statusText: 'Service Unavailable' }
    ));
}

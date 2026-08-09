// Service Worker：白名单预缓存 + cache-first，离线可玩
const CACHE = 'dice-v1';
// 白名单：精确列举全部本地静态资源（相对 sw.js 的路径，部署到子路径也正确）
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/engine.js',
  './js/rules.js',
  './js/dice.js',
  './js/badges.js',
  './js/ai.js',
  './js/tutorial.js',
  './js/ui.js',
  './js/sound.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((rel) => new URL(rel, self.registration.scope).href)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 不缓存跨域资源（如 Google Fonts）
  const inWhitelist = ASSETS.some((rel) =>
    url.pathname === new URL(rel, self.registration.scope).pathname
  );
  if (!inWhitelist) return; // 白名单外走网络
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});

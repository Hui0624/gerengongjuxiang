/* =========================================================
   sw.js —— 个人工作台 Service Worker
   作用：缓存应用外壳，断网也能打开；静态资源走缓存优先；
        新版本检测 + 本地通知展示（点击回到应用）。
   纯前端，不依赖任何后端。
   ========================================================= */
const VERSION = "wb-v11";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "theme.css",
  "app.js",
  "data.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png"
];

/* ---------- 安装：预缓存外壳 ---------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

/* ---------- 激活：清掉旧缓存 ---------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- 请求拦截 ---------- */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // 只处理 GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // 跨域（GitHub API 等）直连

  // 页面导航：网络优先，失败回退到缓存的 index.html（断网也能进 App）
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("index.html")))
    );
    return;
  }

  // 静态资源：缓存优先 + 后台更新（stale-while-revalidate）
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* ---------- 立即激活新版本（配合页面里的「刷新」提示） ---------- */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- 本地通知点击：回到工作台 ---------- */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./?source=notify");
    })
  );
});

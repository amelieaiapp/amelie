/* AMELIE·AI Planner offline service worker. Build 60p-264.
   Opening the app: try the network first (so every launch gets the latest build), but fall back
   to the saved copy after 4 seconds, or at once when there is no connection.
   Icons and other files: saved copy first, refreshed in the background. */
const CACHE = 'amelie-planner-60p-264';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CORE.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('amelie') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return c.match('./index.html').then(function (h2) { return h2 || c.match('./'); });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      var finish = function (r) { if (!done && r) { done = true; resolve(r); } };
      var timer = setTimeout(function () { fromCache(req).then(finish); }, 4000);
      /* ask the server whether a newer build exists (cheap when unchanged), never trust a stale browser copy */
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
        if (res && res.ok) {
          var a = res.clone(), b = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, a); c.put('./', b); });
        }
        clearTimeout(timer);
        finish(res);
      }).catch(function () {
        clearTimeout(timer);
        fromCache(req).then(function (hit) {
          finish(hit || new Response('AMELIE·AI Planner needs to be opened once while online before it can work offline.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
        });
      });
    }));
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
          return res;
        }).catch(function () { return hit || Response.error(); });
        return hit || net;
      });
    })
  );
});

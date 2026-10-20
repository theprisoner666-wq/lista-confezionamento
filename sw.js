// Fa partire l'app anche senza rete. I dati offline li gestisce Firestore da solo:
// qui si conservano i file dell'app, la libreria Firebase e le librerie Excel.
const CACHE = "vgv-v1";
const FILES = ["./", "./index.html", "./calcoli.js", "./firebase-config.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Librerie: l'indirizzo contiene la versione, quindi si prende dalla cache se c'e'.
  if (url.hostname === "www.gstatic.com" || url.hostname === "cdnjs.cloudflare.com") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }

  // File dell'app: prima la rete, cosi' gli aggiornamenti arrivano subito; senza rete, la copia salvata.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html"))));
  }
});

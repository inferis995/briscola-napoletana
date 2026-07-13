// Service worker minimo: serve per l'installabilità PWA.
// Nessuna cache offline: il gioco è realtime, i contenuti vanno sempre in rete.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

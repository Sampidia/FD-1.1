// Service Worker for Fake Products Detector PWA
// Handles offline functionality, caching, and scan result persistence

const CACHE_NAME = 'fake-detector-v1.0.0';
const STATIC_CACHE = 'fake-detector-static-v1.0.0';
const API_CACHE = 'fake-detector-api-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/scan',
  '/dashboard',
  '/pricing',
  '/manifest.json',
  '/logo.png',
  '/favicon.ico',
  '/globals.css',
  // Add other critical assets
];

const API_ENDPOINTS = [
  '/api/user/balance',
  '/api/user/points',
  '/api/public/recent-alerts'
];

// Background sync tag for failed requests
const BG_SYNC_TAG = 'scan-sync';

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('🛠️ Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean old caches and claim clients
self.addEventListener('activate', event => {
  console.log('🎯 Service Worker activating...');
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      clients.claim()
    ])
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    // Cache GET requests (balance, alerts)
    if (request.method === 'GET' && API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
      event.respondWith(cacheFirst(request));
    }
    // Queue POST requests (scans) for offline
    else if (request.method === 'POST' && url.pathname.includes('/verify-product') || url.pathname.includes('/analyze-image')) {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network first for dynamic content
  event.respondWith(networkFirst(request));
});

// Background sync for failed scan requests
self.addEventListener('sync', event => {
  console.log('🔄 Background sync triggered:', event.tag);

  if (event.tag === BG_SYNC_TAG) {
    event.waitUntil(syncPendingScans());
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'view-results') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  } else {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Cache strategies
async function cacheFirst(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fall back to network
    const networkResponse = await fetch(request);

    // Cache successful GET responses
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);

    // Return cached offline fallback for critical resources
    if (request.url.includes('/logo.png') || request.url.includes('/manifest.json')) {
      return caches.match('/logo.png');
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
  }
}

async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Network-first strategy failed:', error);

    // For POST requests (scans), queue for later sync
    if (request.method === 'POST' && (request.url.includes('/verify-product') || request.url.includes('/analyze-image'))) {
      await queueScanForSync(request.clone());

      // Return cached success response if available
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // Return offline success indication
      return new Response(JSON.stringify({
        success: false,
        queued: true,
        message: 'Scan queued for upload when online'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline error
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'This feature requires internet connection'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Queue scan requests for background sync
async function queueScanForSync(request) {
  try {
    // Clone request for storage
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now(),
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Store in IndexedDB (simplified - using cache API)
    const cache = await caches.open('pending-scans');
    const response = new Response(JSON.stringify(requestData), {
      headers: { 'Content-Type': 'application/json' }
    });

    await cache.put(`pending-scan-${requestData.id}`, response);
    console.log('📝 Scan queued for sync:', requestData.id);

    // Register background sync if available
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register(BG_SYNC_TAG);
    }

    // Show notification
    await self.registration.showNotification('Scan Queued', {
      body: 'Your product scan will be uploaded when connection is restored.',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'scan-queued',
      requireInteraction: false,
      actions: [
        { action: 'view-dashboard', title: 'View Dashboard' }
      ]
    });

  } catch (error) {
    console.error('Failed to queue scan:', error);
  }
}

// Process queued scans when back online
async function syncPendingScans() {
  console.log('🔄 Processing queued scans...');

  try {
    const cache = await caches.open('pending-scans');
    const requests = await cache.keys();

    console.log(`📋 Found ${requests.length} pending scans`);

    for (const request of requests) {
      try {
        const response = await cache.match(request);
        if (!response) continue;

        const requestData = await response.json();

        // Reconstruct the original request
        const originalRequest = new Request(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });

        // Retry the request
        const result = await fetch(originalRequest);

        if (result.ok) {
          console.log('✅ Queued scan sync successful');
          await cache.delete(request);

          // Notify user of successful sync
          await self.registration.showNotification('Scan Synced', {
            body: 'Your offline scan has been uploaded successfully.',
            icon: '/logo.png',
            actions: [
              { action: 'view-results', title: 'View Results' }
            ]
          });
        } else {
          console.warn('❌ Queued scan sync failed, will retry later');
        }

      } catch (syncError) {
        console.error('Error syncing individual scan:', syncError);
      }
    }

    console.log('🔄 Scan sync processing complete');

  } catch (error) {
    console.error('Error in background sync:', error);
  }
}

// Cache medication scan results for offline access
async function cacheScanResult(scanId, resultData) {
  try {
    const cache = await caches.open('scan-results');
    const response = new Response(JSON.stringify(resultData), {
      headers: { 'Content-Type': 'application/json' }
    });

    await cache.put(`/api/result/${scanId}`, response);
    console.log('💾 Scan result cached for offline:', scanId);
  } catch (error) {
    console.error('Failed to cache scan result:', error);
  }
}

// Handle periodic background sync (for future features)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'scan-cleanup') {
    event.waitUntil(cleanupOldCachedData());
  }
});

// Clean up old cached data
async function cleanupOldCachedData() {
  try {
    console.log('🧹 Cleaning up old cached data...');

    // Clean old scan results (>30 days)
    const scanCache = await caches.open('scan-results');
    const scanRequests = await scanCache.keys();

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    for (const request of scanRequests) {
      const response = await scanCache.match(request);
      if (!response) continue;

      const cachedAt = response.headers.get('sw-cache-date');
      if (cachedAt && parseInt(cachedAt) < thirtyDaysAgo) {
        await scanCache.delete(request);
      }
    }

    console.log('✅ Cache cleanup complete');
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}

// Message handler for communication with main thread
self.addEventListener('message', event => {
  const { type, data } = event.data;

  switch (type) {
    case 'CACHE_SCAN_RESULT':
      cacheScanResult(data.scanId, data.result);
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    default:
      console.log('Unknown message type:', type);
  }
});

console.log('🚀 Fake Products Detector Service Worker loaded!');

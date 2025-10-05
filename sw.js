// FitnessMate Service Worker
const CACHE_NAME = 'fitmate-v1.0.0';
const STATIC_CACHE = 'fitmate-static-v1.0.0';
const DYNAMIC_CACHE = 'fitmate-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/workout.html',
  '/manifest.json',
  '/Gym.mp3',
  // External CDN resources (cached dynamically)
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js',
  'https://unpkg.com/@supabase/supabase-js@2'
];

// Animation files to cache
const ANIMATION_FILES = [
  '/animations/Bridge.mp4',
  '/animations/Burpee and Jump Exercise.mp4',
  '/animations/Cobras.mp4',
  '/animations/Deadbug fitness exercise.mp4',
  '/animations/Elbow To Knee Crunch (Right).mp4',
  '/animations/Flutter Kicks.mp4',
  '/animations/Frog Press.mp4',
  '/animations/Inchworm.mp4',
  '/animations/Jumping Jack.mp4',
  '/animations/Jumping Lunges.mp4',
  '/animations/Lunge.mp4',
  '/animations/Military Push Ups.mp4',
  '/animations/Plank.mp4',
  '/animations/Punches.mp4',
  '/animations/Reverse Crunches.mp4',
  '/animations/Seated abs circles.mp4',
  '/animations/Side Hip Abduction.mp4',
  '/animations/Single Leg Hip Rotation.mp4',
  '/animations/Split Jump Exercise.mp4',
  '/animations/Squat Reach.mp4',
  '/animations/Squat kicks.mp4',
  '/animations/Squats.mp4',
  '/animations/Staggeredpushups.mp4',
  '/animations/StandingSideBends.mp4',
  '/animations/Widearmpushup.mp4',
  '/animations/calfraise.mp4',
  '/animations/open books.mp4',
  '/animations/spiderman push-up.mp4'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Caching static files...');
        return cache.addAll(STATIC_FILES.concat(ANIMATION_FILES));
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        // For HTML files, also try to update cache in background
        if (request.destination === 'document') {
          updateCacheInBackground(request);
        }
        return cachedResponse;
      }
      
      // Network request with caching for dynamic content
      return fetch(request)
        .then((networkResponse) => {
          // Don't cache non-successful responses
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // Cache successful responses
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          
          // Return a basic offline response for other requests
          return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
    })
  );
});

// Background cache update for HTML files
function updateCacheInBackground(request) {
  fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, response);
        });
      }
    })
    .catch(() => {
      // Ignore network errors in background updates
    });
}

// Handle background sync for workout data
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'workout-sync') {
    event.waitUntil(syncWorkoutData());
  }
});

// Sync workout data when online
async function syncWorkoutData() {
  try {
    // Get pending workout data from IndexedDB or localStorage
    const pendingWorkouts = JSON.parse(localStorage.getItem('pendingWorkouts') || '[]');
    
    if (pendingWorkouts.length > 0) {
      // Send to server when online
      for (const workout of pendingWorkouts) {
        try {
          // This would normally sync with your backend
          console.log('📤 Syncing workout data:', workout);
          // Remove from pending after successful sync
          const index = pendingWorkouts.indexOf(workout);
          if (index > -1) {
            pendingWorkouts.splice(index, 1);
          }
        } catch (error) {
          console.error('❌ Failed to sync workout:', error);
        }
      }
      
      // Update pending workouts
      localStorage.setItem('pendingWorkouts', JSON.stringify(pendingWorkouts));
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Handle push notifications (for future workout reminders)
self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Time for your workout!',
    icon: '/manifest-icon-192.png',
    badge: '/manifest-icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/workout.html'
    },
    actions: [
      {
        action: 'start-workout',
        title: 'Start Workout',
        icon: '/manifest-icon-192.png'
      },
      {
        action: 'dismiss',
        title: 'Later',
        icon: '/manifest-icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('FitnessMate', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'start-workout') {
    event.waitUntil(
      clients.openWindow('/workout.html')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('📨 Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('🚀 FitnessMate Service Worker loaded successfully!');
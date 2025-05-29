// sw.js - Service Worker для Progressive Web App
const CACHE_NAME = 'coco-instrument-v1.2';
const urlsToCache = [
    '/',
    '/css/main.css',
    '/css/auth.css', 
    '/css/coco-money.css',
    '/js/core/EventBus.js',
    '/js/core/StateManager.js',
    '/js/core/APIClient.js',
    '/js/core/Router.js',
    '/js/core/ModuleManager.js',
    '/js/modules/AuthModule.js',
    '/js/modules/HomeModule.js',
    '/js/modules/CocoMoneyModule.js',
    '/js/app.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Обработка запросов
self.addEventListener('fetch', event => {
    // Пропускаем запросы к API
    if (event.request.url.includes('/api/')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Возвращаем кэшированный ответ если есть
                if (response) {
                    return response;
                }
                
                // Клонируем запрос
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    // Проверяем валидность ответа
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Клонируем ответ
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                }).catch(() => {
                    // Если офлайн, показываем кэшированную главную страницу
                    return caches.match('/');
                });
            })
    );
});

// Обработка push-уведомлений (для будущего использования)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Новое уведомление',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png'
    };
    
    event.waitUntil(
        self.registration.showNotification('Coco Instrument', options)
    );
});

// Синхронизация фоновых данных (для будущего использования)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Здесь можно добавить логику синхронизации данных
    console.log('Background sync triggered');
}
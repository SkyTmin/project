// sw.js - Service Worker для PWA функциональности
const CACHE_NAME = 'coco-instrument-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/main.css',
    '/css/auth.css',
    '/css/coco-money.css',
    '/js/app.js',
    '/js/core/EventBus.js',
    '/js/core/StateManager.js',
    '/js/core/Router.js',
    '/js/core/APIClient.js',
    '/js/core/ModuleManager.js',
    '/js/modules/auth/AuthModule.js',
    '/js/modules/coco-money/CocoMoneyModule.js',
    '/manifest.json'
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
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
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
                // Возвращаем кэшированную версию или делаем запрос
                if (response) {
                    return response;
                }

                return fetch(event.request).then(response => {
                    // Проверяем, что получили валидный ответ
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
                });
            })
            .catch(() => {
                // Возвращаем офлайн страницу, если она есть
                return caches.match('/offline.html');
            })
    );
});

// Фоновая синхронизация
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// Функция синхронизации данных
async function syncData() {
    // Здесь можно добавить логику синхронизации данных с сервером
    console.log('Syncing data...');
}
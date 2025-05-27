/**
 * Service Worker для Coco Instrument PWA
 */

const CACHE_NAME = 'coco-instrument-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles/main.css',
    '/styles/auth.css',
    '/styles/coco-money.css',
    '/js/core/EventBus.js',
    '/js/core/StateManager.js',
    '/js/core/APIClient.js',
    '/js/core/ModuleManager.js',
    '/js/modules/AuthModule.js',
    '/js/modules/CocoMoneyModule.js',
    '/js/app.js'
];

/**
 * Установка Service Worker
 */
self.addEventListener('install', (event) => {
    console.log('ServiceWorker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('All files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Error caching files:', error);
            })
    );
});

/**
 * Активация Service Worker
 */
self.addEventListener('activate', (event) => {
    console.log('ServiceWorker activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Удаляем старые кэши
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('ServiceWorker activated');
            return self.clients.claim();
        })
    );
});

/**
 * Обработка fetch запросов
 */
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Возвращаем кэшированную версию, если доступна
                if (response) {
                    return response;
                }
                
                // Клонируем запрос для fetch
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then((response) => {
                    // Проверяем валидность ответа
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Клонируем ответ для кэширования
                    const responseToCache = response.clone();
                    
                    // Кэшируем только GET запросы и исключаем API
                    if (event.request.method === 'GET' && !event.request.url.includes('/api/')) {
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    
                    return response;
                }).catch(() => {
                    // Возвращаем офлайн страницу для навигационных запросов
                    if (event.request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

/**
 * Обработка фоновой синхронизации
 */
self.addEventListener('sync', (event) => {
    console.log('Background sync event:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

/**
 * Выполнение фоновой синхронизации
 */
async function doBackgroundSync() {
    try {
        console.log('Performing background sync...');
        
        // Здесь можно добавить логику синхронизации данных
        // Например, отправка несохраненных данных на сервер
        
        return Promise.resolve();
    } catch (error) {
        console.error('Background sync failed:', error);
        return Promise.reject(error);
    }
}

/**
 * Обработка push уведомлений
 */
self.addEventListener('push', (event) => {
    console.log('Push message received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'Новое уведомление от Coco Instrument',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Открыть приложение',
                icon: '/icons/icon-72.png'
            },
            {
                action: 'close',
                title: 'Закрыть',
                icon: '/icons/icon-72.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Coco Instrument', options)
    );
});

/**
 * Обработка кликов по уведомлениям
 */
self.addEventListener('notificationclick', (event) => {
    console.log('Notification click received:', event);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Открываем приложение
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // Просто закрываем уведомление
        console.log('Notification dismissed');
    } else {
        // Клик по основному уведомлению
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

/**
 * Обработка сообщений от главного потока
 */
self.addEventListener('message', (event) => {
    console.log('ServiceWorker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            type: 'VERSION',
            version: CACHE_NAME
        });
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return cache.addAll(event.data.urls);
                })
                .then(() => {
                    event.ports[0].postMessage({
                        type: 'CACHE_COMPLETE'
                    });
                })
                .catch((error) => {
                    event.ports[0].postMessage({
                        type: 'CACHE_ERROR',
                        error: error.message
                    });
                })
        );
    }
});

/**
 * Утилиты для работы с кэшем
 */

/**
 * Очистка старых кэшей
 */
async function cleanupCaches() {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => name !== CACHE_NAME);
    
    return Promise.all(
        oldCaches.map(name => caches.delete(name))
    );
}

/**
 * Предзагрузка критических ресурсов
 */
async function preloadCriticalResources() {
    const cache = await caches.open(CACHE_NAME);
    const criticalResources = [
        '/',
        '/styles/main.css',
        '/js/app.js'
    ];
    
    return cache.addAll(criticalResources);
}

/**
 * Проверка доступности сети
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Логирование для отладки
 */
function log(message, data = null) {
    console.log(`[ServiceWorker] ${message}`, data);
}

// Инициализация
log('ServiceWorker script loaded');

/**
 * Обработка ошибок
 */
self.addEventListener('error', (event) => {
    console.error('ServiceWorker error:', event.error);
});

/**
 * Обработка необработанных промисов
 */
self.addEventListener('unhandledrejection', (event) => {
    console.error('ServiceWorker unhandled rejection:', event.reason);
    event.preventDefault();
});
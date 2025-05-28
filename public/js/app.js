// app.js - Точка входа приложения Coco Instrument
(function() {
    'use strict';
    
    // Инициализация приложения
    async function initApp() {
        console.log('Coco Instrument starting...');
        
        // Восстанавливаем состояние из localStorage
        const hasStoredState = window.stateManager.restore();
        
        // Если есть сохраненный токен, устанавливаем его в API клиент
        const token = window.stateManager.getState('token');
        if (token) {
            window.apiClient.setAuthToken(token);
        }
        
        // Настраиваем маршруты
        setupRoutes();
        
        // Настраиваем guard для проверки аутентификации
        window.router.setBeforeEach(async (to, from) => {
            const isAuthRoute = to === '/' || to === '/auth';
            const isAuthenticated = await checkAuthentication();
            
            if (!isAuthRoute && !isAuthenticated) {
                // Если пользователь не аутентифицирован, перенаправляем на вход
                window.router.navigate('/');
                return false;
            }
            
            if (isAuthRoute && isAuthenticated) {
                // Если пользователь аутентифицирован, перенаправляем на главную
                window.router.navigate('/home');
                return false;
            }
            
            return true;
        });
        
        // Инициализируем модули
        const authModule = window.moduleManager.get('auth');
        if (authModule && authModule.init) {
            authModule.init();
        }
        
        const homeModule = window.moduleManager.get('home');
        if (homeModule && homeModule.init) {
            homeModule.init();
        }
        
        const cocoMoneyModule = window.moduleManager.get('coco-money');
        if (cocoMoneyModule && cocoMoneyModule.init) {
            cocoMoneyModule.init();
        }
        
        // Обрабатываем начальный маршрут
        if (window.location.hash === '') {
            window.location.hash = '/';
        }
        
        // Регистрируем Service Worker для PWA
        registerServiceWorker();
        
        console.log('Coco Instrument initialized');
    }
    
    // Настройка маршрутов
    function setupRoutes() {
        // Маршрут аутентификации
        window.router.register('/', async () => {
            const isAuthenticated = await checkAuthentication();
            if (isAuthenticated) {
                await window.moduleManager.activateModule('home');
            } else {
                await window.moduleManager.activateModule('auth');
            }
        });
        
        window.router.register('/auth', async () => {
            await window.moduleManager.activateModule('auth');
        });
        
        // Маршрут главной страницы
        window.router.register('/home', async () => {
            await window.moduleManager.activateModule('home');
        });
        
        // Маршрут Coco Money
        window.router.register('/coco-money', async () => {
            await window.moduleManager.activateModule('coco-money');
        });
        
        // Дефолтный маршрут
        window.router.register('*', () => {
            window.router.navigate('/');
        });
    }
    
    // Проверка аутентификации
    async function checkAuthentication() {
        const token = window.stateManager.getState('token');
        if (!token) return false;
        
        try {
            // Проверяем токен на сервере
            const authModule = window.moduleManager.get('auth');
            if (authModule && authModule.checkAuth) {
                return await authModule.checkAuth();
            }
            return false;
        } catch (error) {
            console.error('Authentication check failed:', error);
            return false;
        }
    }
    
    // Регистрация Service Worker
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    // Обработка ошибок
    window.addEventListener('unhandledrejection', event => {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Показываем уведомление об ошибке
        const authModule = window.moduleManager.get('auth');
        if (authModule && authModule.showToast) {
            authModule.showToast('Произошла ошибка', 'error');
        }
    });
    
    // Запускаем приложение когда DOM готов
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();

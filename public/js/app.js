(function() {
    'use strict';
    
    async function initApp() {
        console.log('Coco Instrument starting...');
        
        const hasStoredState = window.stateManager.restore();
        
        const token = window.stateManager.getState('token');
        if (token) {
            window.apiClient.setAuthToken(token);
        }
        
        setupRoutes();
        
        window.router.setBeforeEach(async (to, from) => {
            const isAuthRoute = to === '/' || to === '/auth';
            const isAuthenticated = await checkAuthentication();
            
            if (!isAuthRoute && !isAuthenticated) {
                window.router.navigate('/');
                return false;
            }
            
            if (isAuthRoute && isAuthenticated) {
                window.router.navigate('/home');
                return false;
            }
            
            return true;
        });
        
        ['auth', 'home', 'coco-money'].forEach(moduleId => {
            const module = window.moduleManager.get(moduleId);
            if (module && module.init) {
                module.init();
            }
        });
        
        if (window.location.hash === '') {
            window.location.hash = '/';
        }
        
        registerServiceWorker();
        
        console.log('Coco Instrument initialized');
    }
    
    function setupRoutes() {
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
        
        window.router.register('/home', async () => {
            await window.moduleManager.activateModule('home');
        });
        
        window.router.register('/coco-money', async () => {
            await window.moduleManager.activateModule('coco-money');
        });
        
        window.router.register('*', () => {
            window.router.navigate('/');
        });
    }
    
    async function checkAuthentication() {
        const token = window.stateManager.getState('token');
        if (!token) return false;
        
        try {
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
    
    window.addEventListener('unhandledrejection', event => {
        console.error('Unhandled promise rejection:', event.reason);
        
        const authModule = window.moduleManager.get('auth');
        if (authModule && authModule.showToast) {
            authModule.showToast('Произошла ошибка', 'error');
        }
    });
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();

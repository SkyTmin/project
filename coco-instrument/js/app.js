/**
 * Главный файл приложения Coco Instrument
 */
class CocoInstrumentApp {
    constructor() {
        this.initialized = false;
        this.loadingScreen = null;
    }

    /**
     * Инициализация приложения
     */
    async init() {
        console.log('Initializing Coco Instrument App...');
        
        try {
            // Показываем экран загрузки
            this.showLoadingScreen();
            
            // Настраиваем обработчики событий приложения
            this.setupAppEventHandlers();
            
            // Ждем небольшую паузу для показа экрана загрузки
            await this.delay(1000);
            
            // Инициализируем все модули
            await window.ModuleManager.initializeAll();
            
            // Проверяем аутентификацию пользователя
            await this.checkAuthentication();
            
            // Скрываем экран загрузки
            this.hideLoadingScreen();
            
            // Определяем начальный модуль
            this.determineInitialModule();
            
            this.initialized = true;
            console.log('Coco Instrument App initialized successfully');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Ошибка при инициализации приложения');
        }
    }

    /**
     * Настройка обработчиков событий приложения
     */
    setupAppEventHandlers() {
        // Обработчик готовности приложения
        window.EventBus.on(window.Events.APP_READY, this.onAppReady.bind(this));
        
        // Обработчики UI событий
        window.EventBus.on(window.Events.UI_SHOW_ERROR, this.showError.bind(this));
        window.EventBus.on(window.Events.UI_SHOW_SUCCESS, this.showSuccess.bind(this));
        window.EventBus.on(window.Events.UI_SHOW_LOADING, this.showGlobalLoading.bind(this));
        window.EventBus.on(window.Events.UI_HIDE_LOADING, this.hideGlobalLoading.bind(this));
        
        // Обработчики аутентификации
        window.EventBus.on(window.Events.AUTH_LOGOUT, this.onLogout.bind(this));
        
        // Обработчик ошибок приложения
        window.EventBus.on(window.Events.APP_ERROR, this.onAppError.bind(this));
        
        // Обработчик событий модулей
        window.EventBus.on(window.Events.MODULE_LOADED, this.onModuleLoaded.bind(this));
        
        // Обработчики изменения состояния
        window.StateManager.subscribe('incomeSheets', this.onIncomeSheetChange.bind(this));
        window.StateManager.subscribe('currentSheet', this.onCurrentSheetChange.bind(this));
        
        // Обработчик закрытия страницы
        window.addEventListener('beforeunload', this.onBeforeUnload.bind(this));
        
        // Обработчик ошибок JavaScript
        window.addEventListener('error', this.onJavaScriptError.bind(this));
        
        // Обработчик необработанных Promise
        window.addEventListener('unhandledrejection', this.onUnhandledRejection.bind(this));
    }

    /**
     * Проверка аутентификации пользователя
     */
    async checkAuthentication() {
        try {
            const user = window.StateManager.getState('user');
            const isAuthenticated = window.StateManager.getState('isAuthenticated');
            
            if (user && isAuthenticated) {
                console.log('User already authenticated:', user.email);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking authentication:', error);
            return false;
        }
    }

    /**
     * Определить начальный модуль для активации
     */
    determineInitialModule() {
        const isAuthenticated = window.StateManager.getState('isAuthenticated');
        
        if (isAuthenticated) {
            // Пользователь аутентифицирован, показываем Coco Money
            window.ModuleManager.activateModule('coco-money');
        } else {
            // Пользователь не аутентифицирован, показываем форму входа
            window.ModuleManager.activateModule('auth');
        }
    }

    /**
     * Показать экран загрузки
     */
    showLoadingScreen() {
        this.loadingScreen = document.getElementById('loading-screen');
        if (this.loadingScreen) {
            this.loadingScreen.classList.remove('hidden');
        }
    }

    /**
     * Скрыть экран загрузки
     */
    hideLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add('hidden');
        }
    }

    /**
     * Показать глобальный индикатор загрузки
     */
    showGlobalLoading() {
        // Можно добавить глобальный индикатор загрузки
        document.body.style.cursor = 'wait';
    }

    /**
     * Скрыть глобальный индикатор загрузки
     */
    hideGlobalLoading() {
        document.body.style.cursor = 'default';
    }

    /**
     * Показать сообщение об ошибке
     */
    showError(message) {
        console.error('App Error:', message);
        
        // Простое уведомление об ошибке
        this.showNotification(message, 'error');
    }

    /**
     * Показать сообщение об успехе
     */
    showSuccess(message) {
        console.log('App Success:', message);
        
        // Простое уведомление об успехе
        this.showNotification(message, 'success');
    }

    /**
     * Показать уведомление
     */
    showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Добавляем стили для уведомлений
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 1rem;
                    border-radius: 6px;
                    color: white;
                    font-weight: 500;
                    z-index: 10000;
                    min-width: 250px;
                    animation: slideIn 0.3s ease;
                }
                .notification-error {
                    background-color: var(--danger-color);
                }
                .notification-success {
                    background-color: var(--success-color);
                }
                .notification-info {
                    background-color: var(--primary-color);
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * Обработчик готовности приложения
     */
    onAppReady() {
        console.log('App is ready!');
    }

    /**
     * Обработчик выхода из системы
     */
    onLogout() {
        console.log('User logged out');
        
        // Переходим к модулю аутентификации
        window.ModuleManager.activateModule('auth');
    }

    /**
     * Обработчик ошибки приложения
     */
    onAppError(error) {
        console.error('App Error Event:', error);
        this.showError(typeof error === 'string' ? error : error.message || 'Произошла неизвестная ошибка');
    }

    /**
     * Обработчик загрузки модуля
     */
    onModuleLoaded(module) {
        console.log(`Module loaded: ${module.id}`);
    }

    /**
     * Обработчик изменения листов доходов
     */
    onIncomeSheetChange(sheets) {
        console.log('Income sheets changed:', sheets.length);
    }

    /**
     * Обработчик изменения текущего листа
     */
    onCurrentSheetChange(currentSheet) {
        if (currentSheet) {
            console.log('Current sheet changed:', currentSheet.name);
        }
    }

    /**
     * Обработчик закрытия страницы
     */
    onBeforeUnload(event) {
        // Сохраняем состояние перед закрытием
        window.StateManager.saveState();
        
        // Можно добавить предупреждение о несохраненных изменениях
        // event.preventDefault();
        // event.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?';
    }

    /**
     * Обработчик JavaScript ошибок
     */
    onJavaScriptError(event) {
        console.error('JavaScript Error:', event.error);
        
        // В продакшн версии можно отправлять ошибки на сервер
        window.EventBus.emit(window.Events.APP_ERROR, 'Произошла техническая ошибка');
    }

    /**
     * Обработчик необработанных Promise
     */
    onUnhandledRejection(event) {
        console.error('Unhandled Promise Rejection:', event.reason);
        
        // Предотвращаем вывод ошибки в консоль браузера
        event.preventDefault();
        
        window.EventBus.emit(window.Events.APP_ERROR, 'Произошла ошибка при выполнении операции');
    }

    /**
     * Вспомогательная функция задержки
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Получить информацию о приложении
     */
    getAppInfo() {
        return {
            name: 'Coco Instrument',
            version: '1.0.0',
            initialized: this.initialized,
            modules: window.ModuleManager.getStats(),
            state: window.StateManager.getState()
        };
    }

    /**
     * Перезапустить приложение
     */
    async restart() {
        console.log('Restarting application...');
        
        try {
            // Очищаем состояние
            window.StateManager.clearState();
            
            // Уничтожаем все модули
            const modules = window.ModuleManager.getAllModules();
            modules.forEach(module => {
                window.ModuleManager.destroyModule(module.id);
            });
            
            // Очищаем события
            window.EventBus.clear();
            
            // Перезагружаем страницу
            window.location.reload();
            
        } catch (error) {
            console.error('Error restarting app:', error);
            window.location.reload();
        }
    }
}

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Coco Instrument...');
    
    // Создаем глобальный экземпляр приложения
    window.CocoApp = new CocoInstrumentApp();
    
    // Инициализируем приложение
    await window.CocoApp.init();
});

// Регистрируем Service Worker для PWA (если доступен)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker registered successfully:', registration.scope);
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    });
}

// Экспортируем для отладки
window.CocoInstrument = {
    EventBus: window.EventBus,
    StateManager: window.StateManager,
    ModuleManager: window.ModuleManager,
    APIClient: window.APIClient,
    Events: window.Events
};
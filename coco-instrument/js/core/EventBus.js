/**
 * EventBus - Система событий для межмодульного взаимодействия
 */
class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * Подписаться на событие
     * @param {string} eventName - Название события
     * @param {Function} callback - Функция обратного вызова
     * @param {Object} context - Контекст выполнения (this)
     */
    on(eventName, callback, context = null) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        
        this.events.get(eventName).push({
            callback,
            context
        });
    }

    /**
     * Отписаться от события
     * @param {string} eventName - Название события
     * @param {Function} callback - Функция обратного вызова
     */
    off(eventName, callback) {
        if (!this.events.has(eventName)) {
            return;
        }

        const listeners = this.events.get(eventName);
        const index = listeners.findIndex(listener => listener.callback === callback);
        
        if (index !== -1) {
            listeners.splice(index, 1);
        }

        if (listeners.length === 0) {
            this.events.delete(eventName);
        }
    }

    /**
     * Испустить событие
     * @param {string} eventName - Название события
     * @param {*} data - Данные события
     */
    emit(eventName, data = null) {
        if (!this.events.has(eventName)) {
            return;
        }

        const listeners = this.events.get(eventName);
        listeners.forEach(listener => {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, data);
                } else {
                    listener.callback(data);
                }
            } catch (error) {
                console.error(`Error in event listener for ${eventName}:`, error);
            }
        });
    }

    /**
     * Подписаться на событие один раз
     * @param {string} eventName - Название события
     * @param {Function} callback - Функция обратного вызова
     * @param {Object} context - Контекст выполнения
     */
    once(eventName, callback, context = null) {
        const onceCallback = (data) => {
            callback.call(context, data);
            this.off(eventName, onceCallback);
        };
        
        this.on(eventName, onceCallback);
    }

    /**
     * Очистить все события
     */
    clear() {
        this.events.clear();
    }

    /**
     * Получить список всех событий
     */
    getEvents() {
        return Array.from(this.events.keys());
    }

    /**
     * Проверить наличие слушателей для события
     * @param {string} eventName - Название события
     */
    hasListeners(eventName) {
        return this.events.has(eventName) && this.events.get(eventName).length > 0;
    }
}

// Создаем глобальный экземпляр EventBus
window.EventBus = new EventBus();

// Константы событий
window.Events = {
    // Auth events
    AUTH_LOGIN_SUCCESS: 'auth:login:success',
    AUTH_LOGIN_FAILED: 'auth:login:failed',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_REGISTER_SUCCESS: 'auth:register:success',
    AUTH_REGISTER_FAILED: 'auth:register:failed',
    
    // App events
    APP_READY: 'app:ready',
    APP_ERROR: 'app:error',
    MODULE_LOADED: 'module:loaded',
    
    // Coco Money events
    SHEET_CREATED: 'sheet:created',
    SHEET_UPDATED: 'sheet:updated',
    SHEET_DELETED: 'sheet:deleted',
    SHEET_SELECTED: 'sheet:selected',
    
    EXPENSE_CREATED: 'expense:created',
    EXPENSE_UPDATED: 'expense:updated',
    EXPENSE_DELETED: 'expense:deleted',
    
    // UI events
    UI_SHOW_LOADING: 'ui:show:loading',
    UI_HIDE_LOADING: 'ui:hide:loading',
    UI_SHOW_ERROR: 'ui:show:error',
    UI_SHOW_SUCCESS: 'ui:show:success'
};
// StateManager.js - Управление глобальным состоянием приложения
class StateManager {
    constructor() {
        this.state = {
            user: null,
            currentModule: null,
            incomeSheets: [],
            activeSheetId: null
        };
        this.listeners = {};
    }

    // Получить состояние
    getState(path) {
        if (!path) return this.state;
        
        const keys = path.split('.');
        let value = this.state;
        
        for (const key of keys) {
            value = value[key];
            if (value === undefined) return undefined;
        }
        
        return value;
    }

    // Установить состояние
    setState(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.state;
        
        for (const key of keys) {
            if (!target[key]) {
                target[key] = {};
            }
            target = target[key];
        }
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // Уведомляем слушателей
        this.notifyListeners(path, value, oldValue);
    }

    // Подписка на изменения
    subscribe(path, callback) {
        if (!this.listeners[path]) {
            this.listeners[path] = [];
        }
        
        this.listeners[path].push(callback);
        
        // Возвращаем функцию отписки
        return () => {
            this.unsubscribe(path, callback);
        };
    }

    // Отписка
    unsubscribe(path, callback) {
        if (!this.listeners[path]) return;
        
        this.listeners[path] = this.listeners[path].filter(cb => cb !== callback);
    }

    // Уведомление слушателей
    notifyListeners(path, newValue, oldValue) {
        // Уведомляем точных слушателей
        if (this.listeners[path]) {
            this.listeners[path].forEach(callback => {
                callback(newValue, oldValue);
            });
        }
        
        // Уведомляем слушателей родительских путей
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            if (this.listeners[parentPath]) {
                this.listeners[parentPath].forEach(callback => {
                    callback(this.getState(parentPath));
                });
            }
        }
    }

    // Сохранение в localStorage
    persist(key) {
        try {
            localStorage.setItem(key, JSON.stringify(this.state));
        } catch (error) {
            console.error('Error persisting state:', error);
        }
    }

    // Загрузка из localStorage
    restore(key) {
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                this.state = JSON.parse(stored);
                this.notifyListeners('', this.state, {});
            }
        } catch (error) {
            console.error('Error restoring state:', error);
        }
    }

    // Очистка состояния
    clear() {
        const oldState = this.state;
        this.state = {
            user: null,
            currentModule: null,
            incomeSheets: [],
            activeSheetId: null
        };
        this.notifyListeners('', this.state, oldState);
    }
}

// Создаем глобальный экземпляр
window.StateManager = new StateManager();
// EventBus.js - Система событий для межмодульного взаимодействия
class EventBus {
    constructor() {
        this.events = {};
    }

    // Подписка на событие
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        
        // Возвращаем функцию отписки
        return () => this.off(event, callback);
    }

    // Отписка от события
    off(event, callback) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    // Однократная подписка на событие
    once(event, callback) {
        const onceWrapper = (...args) => {
            callback(...args);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
    }

    // Генерация события
    emit(event, ...args) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }

    // Очистка всех подписок для события
    clear(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }
}

// Создаем глобальный экземпляр
window.eventBus = new EventBus();
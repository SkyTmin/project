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
        return () => {
            this.off(event, callback);
        };
    }

    // Отписка от события
    off(event, callback) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    // Вызов события
    emit(event, data) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }

    // Одноразовая подписка
    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    // Очистка всех подписок
    clear() {
        this.events = {};
    }
}

// Создаем глобальный экземпляр
window.EventBus = new EventBus();
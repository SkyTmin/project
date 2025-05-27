// Router.js - Система маршрутизации
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        
        // Слушаем изменения URL
        window.addEventListener('popstate', () => this.handleRoute());
    }

    // Регистрация маршрута
    register(path, handler) {
        this.routes[path] = handler;
    }

    // Навигация
    navigate(path, data = {}) {
        // Обновляем URL без перезагрузки
        window.history.pushState(data, '', `#${path}`);
        this.handleRoute();
    }

    // Обработка текущего маршрута
    handleRoute() {
        const path = window.location.hash.slice(1) || '/';
        
        // Находим подходящий маршрут
        let handler = null;
        let params = {};
        
        for (const [routePath, routeHandler] of Object.entries(this.routes)) {
            const match = this.matchRoute(routePath, path);
            if (match) {
                handler = routeHandler;
                params = match;
                break;
            }
        }

        if (handler) {
            this.currentRoute = path;
            handler(params, window.history.state || {});
            window.EventBus.emit('route:change', { path, params });
        } else {
            // Маршрут не найден - переходим на главную
            this.navigate('/');
        }
    }

    // Проверка соответствия маршрута
    matchRoute(routePath, actualPath) {
        // Простая проверка для точного совпадения
        if (routePath === actualPath) {
            return {};
        }

        // Проверка с параметрами (например, /sheet/:id)
        const routeParts = routePath.split('/');
        const actualParts = actualPath.split('/');
        
        if (routeParts.length !== actualParts.length) {
            return null;
        }

        const params = {};
        
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                // Это параметр
                const paramName = routeParts[i].slice(1);
                params[paramName] = actualParts[i];
            } else if (routeParts[i] !== actualParts[i]) {
                // Не совпадает
                return null;
            }
        }

        return params;
    }

    // Получить текущий маршрут
    getCurrentRoute() {
        return this.currentRoute || window.location.hash.slice(1) || '/';
    }

    // Проверка активного маршрута
    isActive(path) {
        return this.getCurrentRoute() === path;
    }

    // Перезагрузка текущего маршрута
    reload() {
        this.handleRoute();
    }
}

// Создаем глобальный экземпляр
window.Router = new Router();
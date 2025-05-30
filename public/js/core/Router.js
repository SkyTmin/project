// Router.js - Простой роутер для SPA
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.beforeEach = null;
        
        // Обработка изменения хэша
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    // Регистрация маршрута
    register(path, handler) {
        this.routes.set(path, handler);
    }

    // Установка guard функции
    setBeforeEach(guard) {
        this.beforeEach = guard;
    }

    // Навигация к маршруту
    navigate(path) {
        window.location.hash = path;
    }

    // Обработка текущего маршрута
    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        console.log('Navigating to route:', hash);

        // Вызываем guard если есть
        if (this.beforeEach) {
            const canProceed = await this.beforeEach(hash, this.currentRoute);
            if (!canProceed) return;
        }
        
        this.currentRoute = hash;
        
        // Находим обработчик
        let handler = this.routes.get(hash);

        // Если точного совпадения нет, ищем с параметрами
        if (!handler) {
            for (const [route, routeHandler] of this.routes) {
                const regex = this.routeToRegex(route);
                const match = hash.match(regex);
                if (match) {
                    handler = routeHandler;
                    break;
                }
            }
        }

        // Если обработчик не найден, используем дефолтный
        if (!handler) {
            handler = this.routes.get('*') || (() => console.error('Route not found:', hash));
        }

        // Логирование перед активацией маршрута
        console.log('Current route handler:', handler);

        // Вызываем обработчик
        try {
            await handler(hash);
        } catch (error) {
            console.error('Error in route handler:', error);
        }
    }

    // Преобразование маршрута в регулярное выражение
    routeToRegex(route) {
        return new RegExp('^' + route.replace(/:\w+/g, '([^/]+)') + '$');
    }

    // Получение параметров из маршрута
    getParams(route, path) {
        const regex = this.routeToRegex(route);
        const match = path.match(regex);
        if (!match) return {};
        
        const paramNames = (route.match(/:\w+/g) || []).map(p => p.slice(1));
        const params = {};
        
        paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
        });
        
        return params;
    }

    // Проверка активного маршрута
    isActive(path) {
        return this.currentRoute === path;
    }
}

// Создаем глобальный экземпляр
window.router = new Router();

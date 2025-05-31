(function() {
    'use strict';
    
    class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.beforeEach = null;
        
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    register(path, handler) {
        this.routes.set(path, handler);
    }

    setBeforeEach(guard) {
        this.beforeEach = guard;
    }

    navigate(path) {
        window.location.hash = path;
    }

    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        console.log('Navigating to route:', hash);

        if (this.beforeEach) {
            const canProceed = await this.beforeEach(hash, this.currentRoute);
            if (!canProceed) return;
        }
        
        this.currentRoute = hash;
        
        let handler = this.routes.get(hash);

        if (!handler) {
            for (const [route, routeHandler] of this.routes) {
                const regex = this.routeToRegex(route);
                if (hash.match(regex)) {
                    handler = routeHandler;
                    break;
                }
            }
        }

        if (!handler) {
            handler = this.routes.get('*') || (() => console.error('Route not found:', hash));
        }

        try {
            await handler(hash);
        } catch (error) {
            console.error('Error in route handler:', error);
        }
    }

    routeToRegex(route) {
        return new RegExp('^' + route.replace(/:\w+/g, '([^/]+)') + '$');
    }

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

    isActive(path) {
        return this.currentRoute === path;
    }
}

window.router = new Router();
})();

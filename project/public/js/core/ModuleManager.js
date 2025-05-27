// ModuleManager.js - Управление модулями приложения
class ModuleManager {
    constructor() {
        this.modules = {};
        this.activeModule = null;
    }

    // Регистрация модуля
    register(module) {
        if (!module.id || !module.name) {
            throw new Error('Module must have id and name');
        }

        this.modules[module.id] = module;
        console.log(`Module registered: ${module.name}`);

        // Регистрируем маршруты модуля
        if (module.routes) {
            Object.entries(module.routes).forEach(([path, handler]) => {
                window.Router.register(path, (...args) => {
                    this.activateModule(module.id);
                    handler.call(module, ...args);
                });
            });
        }

        // Подписываемся на события модуля
        if (module.events) {
            Object.entries(module.events).forEach(([event, handler]) => {
                window.EventBus.on(event, handler.bind(module));
            });
        }
    }

    // Получить модуль
    get(moduleId) {
        return this.modules[moduleId];
    }

    // Активировать модуль
    async activateModule(moduleId) {
        const module = this.modules[moduleId];
        if (!module) {
            console.error(`Module not found: ${moduleId}`);
            return;
        }

        // Деактивируем текущий модуль
        if (this.activeModule && this.activeModule !== module) {
            await this.deactivateModule(this.activeModule.id);
        }

        try {
            // Инициализируем модуль, если нужно
            if (!module.initialized && module.init) {
                await module.init();
                module.initialized = true;
            }

            // Активируем модуль
            if (module.activate) {
                await module.activate();
            }

            this.activeModule = module;
            window.StateManager.setState('currentModule', moduleId);
            window.EventBus.emit('module:activated', { moduleId });

        } catch (error) {
            console.error(`Error activating module ${moduleId}:`, error);
        }
    }

    // Деактивировать модуль
    async deactivateModule(moduleId) {
        const module = this.modules[moduleId];
        if (!module) return;

        try {
            if (module.deactivate) {
                await module.deactivate();
            }

            if (this.activeModule === module) {
                this.activeModule = null;
            }

            window.EventBus.emit('module:deactivated', { moduleId });

        } catch (error) {
            console.error(`Error deactivating module ${moduleId}:`, error);
        }
    }

    // Получить список модулей
    getModules() {
        return Object.values(this.modules);
    }

    // Проверить, активен ли модуль
    isActive(moduleId) {
        return this.activeModule && this.activeModule.id === moduleId;
    }

    // Очистить все модули
    clear() {
        Object.keys(this.modules).forEach(moduleId => {
            this.deactivateModule(moduleId);
        });
        this.modules = {};
        this.activeModule = null;
    }
}

// Создаем глобальный экземпляр
window.ModuleManager = new ModuleManager();
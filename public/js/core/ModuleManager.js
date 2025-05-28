// ModuleManager.js - Управление модулями приложения
class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.activeModule = null;
    }

    // Регистрация модуля
    register(module) {
        if (!module.id || !module.name) {
            throw new Error('Module must have id and name');
        }
        
        this.modules.set(module.id, module);
        console.log(`Module registered: ${module.name}`);
        
        // Если модуль имеет маршруты, регистрируем их
        if (module.routes) {
            Object.entries(module.routes).forEach(([path, handler]) => {
                window.router.register(path, async () => {
                    await this.activateModule(module.id);
                    handler();
                });
            });
        }
    }

    // Получение модуля
    get(moduleId) {
        return this.modules.get(moduleId);
    }

    // Активация модуля
    async activateModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            console.error(`Module not found: ${moduleId}`);
            return;
        }

        // Деактивируем текущий модуль
        if (this.activeModule && this.activeModule.id !== moduleId) {
            await this.deactivateModule(this.activeModule.id);
        }

        console.log(`Activating module: ${module.name}`);

        // Проверяем зависимости
        if (module.dependencies) {
            for (const dep of module.dependencies) {
                if (!this.modules.has(dep)) {
                    console.error(`Missing dependency: ${dep} for module ${module.name}`);
                    return;
                }
            }
        }

        // Инициализируем модуль если нужно
        if (module.init && !module.initialized) {
            await module.init();
            module.initialized = true;
        }

        // Активируем модуль
        if (module.activate) {
            await module.activate();
        }

        // Рендерим модуль
        if (module.render) {
            module.render();
        }

        this.activeModule = module;
        window.eventBus.emit('module:activated', module);
    }

    // Деактивация модуля
    async deactivateModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) return;

        console.log(`Deactivating module: ${module.name}`);

        if (module.deactivate) {
            await module.deactivate();
        }

        if (module.destroy) {
            await module.destroy();
        }

        window.eventBus.emit('module:deactivated', module);
    }

    // Получение всех модулей
    getAllModules() {
        return Array.from(this.modules.values());
    }

    // Проверка активности модуля
    isActive(moduleId) {
        return this.activeModule && this.activeModule.id === moduleId;
    }
}

// Создаем глобальный экземпляр
window.moduleManager = new ModuleManager();
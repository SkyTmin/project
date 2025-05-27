/**
 * ModuleManager - Управление модулями приложения
 */
class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.activeModule = null;
        this.initialized = false;
    }

    /**
     * Зарегистрировать модуль
     * @param {Object} module - Модуль для регистрации
     */
    register(module) {
        if (!module.id || !module.name) {
            throw new Error('Module must have id and name');
        }

        if (this.modules.has(module.id)) {
            console.warn(`Module ${module.id} is already registered`);
            return;
        }

        // Проверяем зависимости
        if (module.dependencies && module.dependencies.length > 0) {
            const missingDeps = module.dependencies.filter(dep => !this.modules.has(dep));
            if (missingDeps.length > 0) {
                throw new Error(`Module ${module.id} has missing dependencies: ${missingDeps.join(', ')}`);
            }
        }

        this.modules.set(module.id, module);
        console.log(`Module ${module.id} registered successfully`);

        // Если приложение уже инициализировано, инициализируем модуль
        if (this.initialized) {
            this.initializeModule(module);
        }

        window.EventBus.emit(window.Events.MODULE_LOADED, module);
    }

    /**
     * Получить модуль по ID
     * @param {string} moduleId - ID модуля
     */
    getModule(moduleId) {
        return this.modules.get(moduleId);
    }

    /**
     * Получить все модули
     */
    getAllModules() {
        return Array.from(this.modules.values());
    }

    /**
     * Инициализировать модуль
     * @param {Object} module - Модуль для инициализации
     */
    async initializeModule(module) {
        try {
            console.log(`Initializing module: ${module.id}`);
            
            if (typeof module.init === 'function') {
                await module.init();
            }
            
            // Регистрируем обработчики событий модуля
            if (module.events) {
                Object.keys(module.events).forEach(eventName => {
                    window.EventBus.on(eventName, module.events[eventName], module);
                });
            }
            
            module.initialized = true;
            console.log(`Module ${module.id} initialized successfully`);
            
        } catch (error) {
            console.error(`Error initializing module ${module.id}:`, error);
            throw error;
        }
    }

    /**
     * Активировать модуль
     * @param {string} moduleId - ID модуля
     */
    activateModule(moduleId) {
        const module = this.modules.get(moduleId);
        
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }

        if (!module.initialized) {
            throw new Error(`Module ${moduleId} is not initialized`);
        }

        // Деактивируем текущий модуль
        if (this.activeModule && this.activeModule !== module) {
            this.deactivateModule(this.activeModule.id);
        }

        this.activeModule = module;
        window.StateManager.setState('currentModule', moduleId);

        // Показываем модуль
        if (typeof module.show === 'function') {
            module.show();
        }

        console.log(`Module ${moduleId} activated`);
    }

    /**
     * Деактивировать модуль
     * @param {string} moduleId - ID модуля
     */
    deactivateModule(moduleId) {
        const module = this.modules.get(moduleId);
        
        if (!module) {
            return;
        }

        // Скрываем модуль
        if (typeof module.hide === 'function') {
            module.hide();
        }

        if (this.activeModule === module) {
            this.activeModule = null;
        }

        console.log(`Module ${moduleId} deactivated`);
    }

    /**
     * Уничтожить модуль
     * @param {string} moduleId - ID модуля
     */
    destroyModule(moduleId) {
        const module = this.modules.get(moduleId);
        
        if (!module) {
            return;
        }

        // Деактивируем модуль
        this.deactivateModule(moduleId);

        // Отписываемся от событий
        if (module.events) {
            Object.keys(module.events).forEach(eventName => {
                window.EventBus.off(eventName, module.events[eventName]);
            });
        }

        // Вызываем метод уничтожения модуля
        if (typeof module.destroy === 'function') {
            module.destroy();
        }

        this.modules.delete(moduleId);
        console.log(`Module ${moduleId} destroyed`);
    }

    /**
     * Топологическая сортировка модулей по зависимостям
     * @param {Array} modules - Массив модулей
     */
    topologicalSort(modules) {
        const visited = new Set();
        const result = [];
        
        const visit = (module) => {
            if (visited.has(module.id)) {
                return;
            }
            
            visited.add(module.id);
            
            // Сначала обрабатываем зависимости
            if (module.dependencies) {
                module.dependencies.forEach(depId => {
                    const dep = modules.find(m => m.id === depId);
                    if (dep) {
                        visit(dep);
                    }
                });
            }
            
            result.push(module);
        };
        
        modules.forEach(visit);
        return result;
    }

    /**
     * Получить активный модуль
     */
    getActiveModule() {
        return this.activeModule;
    }

    /**
     * Проверить, инициализированы ли все модули
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Перезагрузить модуль
     * @param {string} moduleId - ID модуля
     */
    async reloadModule(moduleId) {
        const module = this.modules.get(moduleId);
        
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }

        // Деактивируем и уничтожаем
        this.deactivateModule(moduleId);
        
        if (typeof module.destroy === 'function') {
            module.destroy();
        }

        // Сбрасываем состояние
        module.initialized = false;

        // Инициализируем заново
        await this.initializeModule(module);
    }

    /**
     * Получить информацию о модуле
     * @param {string} moduleId - ID модуля
     */
    getModuleInfo(moduleId) {
        const module = this.modules.get(moduleId);
        
        if (!module) {
            return null;
        }

        return {
            id: module.id,
            name: module.name,
            version: module.version || '1.0.0',
            dependencies: module.dependencies || [],
            initialized: module.initialized || false,
            active: this.activeModule === module
        };
    }

    /**
     * Получить статистику по модулям
     */
    getStats() {
        const modules = Array.from(this.modules.values());
        
        return {
            total: modules.length,
            initialized: modules.filter(m => m.initialized).length,
            active: this.activeModule ? 1 : 0,
            modules: modules.map(m => this.getModuleInfo(m.id))
        };
    }
}

// Создаем глобальный экземпляр ModuleManager
window.ModuleManager = new ModuleManager();ициализировать все модули
     */
    async initializeAll() {
        console.log('Initializing all modules...');
        
        const modules = Array.from(this.modules.values());
        
        // Сортируем модули по зависимостям
        const sortedModules = this.topologicalSort(modules);
        
        for (const module of sortedModules) {
            await this.initializeModule(module);
        }

        this.initialized = true;
        window.EventBus.emit(window.Events.APP_READY);
    }

    /**
     * Ин
(function() {
    'use strict';
    
    class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.activeModule = null;
    }

    register(module) {
        if (!module.id || !module.name) {
            throw new Error('Module must have id and name');
        }
        
        this.modules.set(module.id, module);
        
        if (module.routes) {
            Object.entries(module.routes).forEach(([path, handler]) => {
                window.router.register(path, async () => {
                    await this.activateModule(module.id);
                    handler();
                });
            });
        }
    }

    get(moduleId) {
        return this.modules.get(moduleId);
    }

    async activateModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            console.error(`Module not found: ${moduleId}`);
            return;
        }

        if (this.activeModule && this.activeModule.id !== moduleId) {
            await this.deactivateModule(this.activeModule.id);
        }

        if (module.dependencies) {
            for (const dep of module.dependencies) {
                if (!this.modules.has(dep)) {
                    console.error(`Missing dependency: ${dep} for module ${module.name}`);
                    return;
                }
            }
        }

        if (module.init && !module.initialized) {
            await module.init();
            module.initialized = true;
        }

        if (module.activate) await module.activate();
        if (module.render) module.render();

        this.activeModule = module;
        window.eventBus.emit('module:activated', module);
    }

    async deactivateModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) return;

        if (module.deactivate) await module.deactivate();
        if (module.destroy) await module.destroy();

        window.eventBus.emit('module:deactivated', module);
    }

    getAllModules() {
        return Array.from(this.modules.values());
    }

    isActive(moduleId) {
        return this.activeModule && this.activeModule.id === moduleId;
    }
}

window.moduleManager = new ModuleManager();
})();

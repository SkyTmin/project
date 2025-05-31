(function() {
    'use strict';
    
    class StateManager {
    constructor() {
        this.state = {
            user: null,
            token: null,
            incomeSheets: [],
            activeSheetId: null,
            expenses: []
        };
        this.listeners = new Map();
    }

    getState(path = null) {
        if (!path) return this.state;
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    setState(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.state);
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        this.notifyListeners(path, value, oldValue);
        this.persist();
    }

    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        this.listeners.get(path).add(callback);
        
        return () => {
            const listeners = this.listeners.get(path);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    this.listeners.delete(path);
                }
            }
        };
    }

    notifyListeners(path, newValue, oldValue) {
        const exactListeners = this.listeners.get(path);
        if (exactListeners) {
            exactListeners.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error(`Error in state listener for ${path}:`, error);
                }
            });
        }
        
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentListeners = this.listeners.get(parentPath);
            if (parentListeners) {
                parentListeners.forEach(callback => {
                    try {
                        callback(this.getState(parentPath));
                    } catch (error) {
                        console.error(`Error in state listener for ${parentPath}:`, error);
                    }
                });
            }
        }
    }

    persist() {
        try {
            if (this.state.token) {
                const persistState = {
                    token: this.state.token,
                    user: this.state.user
                };
                localStorage.setItem('cocoAppState', JSON.stringify(persistState));
            }
        } catch (error) {
            console.error('Error persisting state:', error);
        }
    }

    restore() {
        try {
            const saved = localStorage.getItem('cocoAppState');
            if (saved) {
                const persistState = JSON.parse(saved);
                Object.assign(this.state, persistState);
                return true;
            }
        } catch (error) {
            console.error('Error restoring state:', error);
        }
        return false;
    }

    clear() {
        this.state = {
            user: null,
            token: null,
            incomeSheets: [],
            activeSheetId: null,
            expenses: []
        };
        localStorage.removeItem('cocoAppState');
        this.notifyListeners('', this.state, null);
    }

    getActiveSheet() {
        return this.state.incomeSheets.find(sheet => sheet.id === this.state.activeSheetId);
    }

    getActiveSheetExpenses() {
        if (!this.state.activeSheetId) return [];
        return this.state.expenses.filter(expense => expense.income_sheet_id === this.state.activeSheetId);
    }

    calculateSheetBalance(sheetId) {
        const sheet = this.state.incomeSheets.find(s => s.id === sheetId);
        if (!sheet) return 0;
        
        const expenses = this.state.expenses
            .filter(e => e.income_sheet_id === sheetId && !e.is_preliminary)
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        return parseFloat(sheet.income_amount) - expenses;
    }

    calculateTotalBalance() {
        return this.state.incomeSheets
            .filter(sheet => !sheet.exclude_from_balance && !sheet.is_preliminary)
            .reduce((total, sheet) => total + this.calculateSheetBalance(sheet.id), 0);
    }
}

window.stateManager = new StateManager();
})();

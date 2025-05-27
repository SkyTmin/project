/**
 * StateManager - Управление состоянием приложения
 */
class StateManager {
    constructor() {
        this.state = {
            user: null,
            isAuthenticated: false,
            currentModule: null,
            incomeSheets: [],
            currentSheet: null,
            expenses: {},
            loading: false,
            error: null
        };
        
        this.subscribers = new Map();
        this.storageKey = 'coco-instrument-state';
        
        // Загружаем сохраненное состояние
        this.loadState();
    }

    /**
     * Получить текущее состояние
     * @param {string} key - Ключ состояния
     */
    getState(key = null) {
        if (key) {
            return this.state[key];
        }
        return { ...this.state };
    }

    /**
     * Установить состояние
     * @param {string|Object} key - Ключ или объект состояния
     * @param {*} value - Значение
     */
    setState(key, value = null) {
        const prevState = { ...this.state };
        
        if (typeof key === 'object') {
            // Если передан объект, обновляем несколько значений
            Object.keys(key).forEach(k => {
                this.state[k] = key[k];
            });
        } else {
            // Обновляем одно значение
            this.state[key] = value;
        }

        // Сохраняем состояние
        this.saveState();
        
        // Уведомляем подписчиков
        this.notifySubscribers(prevState, this.state);
    }

    /**
     * Подписаться на изменения состояния
     * @param {string} key - Ключ состояния
     * @param {Function} callback - Функция обратного вызова
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }
        
        this.subscribers.get(key).push(callback);
        
        // Возвращаем функцию отписки
        return () => {
            const callbacks = this.subscribers.get(key);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Уведомить подписчиков об изменениях
     * @param {Object} prevState - Предыдущее состояние
     * @param {Object} newState - Новое состояние
     */
    notifySubscribers(prevState, newState) {
        Object.keys(newState).forEach(key => {
            if (prevState[key] !== newState[key] && this.subscribers.has(key)) {
                this.subscribers.get(key).forEach(callback => {
                    try {
                        callback(newState[key], prevState[key]);
                    } catch (error) {
                        console.error(`Error in state subscriber for ${key}:`, error);
                    }
                });
            }
        });
    }

    /**
     * Сохранить состояние в localStorage
     */
    saveState() {
        try {
            const stateToSave = {
                user: this.state.user,
                isAuthenticated: this.state.isAuthenticated,
                incomeSheets: this.state.incomeSheets,
                expenses: this.state.expenses
            };
            
            // Сохраняем в памяти (не используем localStorage согласно ограничениям)
            window.savedState = stateToSave;
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    /**
     * Загрузить состояние
     */
    loadState() {
        try {
            // Загружаем из памяти
            const savedState = window.savedState;
            if (savedState) {
                this.state = {
                    ...this.state,
                    ...savedState
                };
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }

    /**
     * Очистить состояние
     */
    clearState() {
        this.state = {
            user: null,
            isAuthenticated: false,
            currentModule: null,
            incomeSheets: [],
            currentSheet: null,
            expenses: {},
            loading: false,
            error: null
        };
        
        window.savedState = null;
        this.saveState();
    }

    // Методы для работы с пользователем
    setUser(user) {
        this.setState({
            user: user,
            isAuthenticated: !!user
        });
    }

    logout() {
        this.clearState();
        window.EventBus.emit(window.Events.AUTH_LOGOUT);
    }

    // Методы для работы с листами доходов
    addIncomeSheet(sheet) {
        const sheets = [...this.state.incomeSheets];
        sheet.id = Date.now().toString(); // Простой ID
        sheets.push(sheet);
        
        this.setState({
            incomeSheets: sheets,
            currentSheet: sheet
        });
        
        // Инициализируем расходы для нового листа
        this.setState('expenses', {
            ...this.state.expenses,
            [sheet.id]: []
        });
        
        return sheet;
    }

    updateIncomeSheet(sheetId, updates) {
        const sheets = this.state.incomeSheets.map(sheet => 
            sheet.id === sheetId ? { ...sheet, ...updates } : sheet
        );
        
        this.setState('incomeSheets', sheets);
        
        if (this.state.currentSheet && this.state.currentSheet.id === sheetId) {
            this.setState('currentSheet', { ...this.state.currentSheet, ...updates });
        }
    }

    deleteIncomeSheet(sheetId) {
        const sheets = this.state.incomeSheets.filter(sheet => sheet.id !== sheetId);
        const expenses = { ...this.state.expenses };
        delete expenses[sheetId];
        
        this.setState({
            incomeSheets: sheets,
            expenses: expenses,
            currentSheet: sheets.length > 0 ? sheets[0] : null
        });
    }

    setCurrentSheet(sheet) {
        this.setState('currentSheet', sheet);
    }

    // Методы для работы с расходами
    addExpense(sheetId, expense) {
        const expenses = { ...this.state.expenses };
        if (!expenses[sheetId]) {
            expenses[sheetId] = [];
        }
        
        expense.id = Date.now().toString();
        expense.date = new Date().toISOString();
        expenses[sheetId].push(expense);
        
        this.setState('expenses', expenses);
        return expense;
    }

    updateExpense(sheetId, expenseId, updates) {
        const expenses = { ...this.state.expenses };
        if (expenses[sheetId]) {
            expenses[sheetId] = expenses[sheetId].map(expense =>
                expense.id === expenseId ? { ...expense, ...updates } : expense
            );
            this.setState('expenses', expenses);
        }
    }

    deleteExpense(sheetId, expenseId) {
        const expenses = { ...this.state.expenses };
        if (expenses[sheetId]) {
            expenses[sheetId] = expenses[sheetId].filter(expense => expense.id !== expenseId);
            this.setState('expenses', expenses);
        }
    }

    getSheetExpenses(sheetId) {
        return this.state.expenses[sheetId] || [];
    }

    // Вычисляемые значения
    getSheetBalance(sheetId) {
        const sheet = this.state.incomeSheets.find(s => s.id === sheetId);
        if (!sheet) return 0;
        
        const expenses = this.getSheetExpenses(sheetId);
        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
        
        return parseFloat(sheet.income || 0) - totalExpenses;
    }
}

// Создаем глобальный экземпляр StateManager
window.StateManager = new StateManager();
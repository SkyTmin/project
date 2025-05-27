/**
 * APIClient - HTTP клиент для работы с API
 */
class APIClient {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        this.token = null;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Установить токен авторизации
     * @param {string} token - JWT токен
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * Получить заголовки запроса
     * @param {Object} customHeaders - Дополнительные заголовки
     */
    getHeaders(customHeaders = {}) {
        const headers = { ...this.defaultHeaders, ...customHeaders };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    /**
     * Базовый метод для выполнения запросов
     * @param {string} url - URL запроса
     * @param {Object} options - Опции fetch
     */
    async request(url, options = {}) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
        
        const config = {
            ...options,
            headers: this.getHeaders(options.headers)
        };

        try {
            window.EventBus.emit(window.Events.UI_SHOW_LOADING);
            
            const response = await fetch(fullUrl, config);
            
            // Проверяем content-type перед парсингом JSON
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Если это не JSON, читаем как текст
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${response.status}`);
            }
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            window.EventBus.emit(window.Events.UI_HIDE_LOADING);
            return data;
            
        } catch (error) {
            window.EventBus.emit(window.Events.UI_HIDE_LOADING);
            // Не показываем ошибки для health check
            if (!url.includes('/health')) {
                window.EventBus.emit(window.Events.UI_SHOW_ERROR, error.message);
            }
            throw error;
        }
    }

    /**
     * GET запрос
     * @param {string} url - URL запроса
     * @param {Object} params - Параметры запроса
     */
    async get(url, params = {}) {
        const urlParams = new URLSearchParams(params);
        const fullUrl = urlParams.toString() ? `${url}?${urlParams}` : url;
        
        return this.request(fullUrl, { method: 'GET' });
    }

    /**
     * POST запрос
     * @param {string} url - URL запроса
     * @param {Object} data - Данные запроса
     */
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT запрос
     * @param {string} url - URL запроса
     * @param {Object} data - Данные запроса
     */
    async put(url, data = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE запрос
     * @param {string} url - URL запроса
     */
    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }

    // API методы для аутентификации
    async login(email, password) {
        try {
            const response = await this.post('/auth/login', { email, password });
            
            if (response.token) {
                this.setToken(response.token);
                window.StateManager.setUser(response.user);
                window.EventBus.emit(window.Events.AUTH_LOGIN_SUCCESS, response.user);
            }
            
            return response;
        } catch (error) {
            window.EventBus.emit(window.Events.AUTH_LOGIN_FAILED, error.message);
            throw error;
        }
    }

    async register(email, password, verificationDate) {
        try {
            const response = await this.post('/auth/register', {
                email,
                password,
                verificationDate
            });
            
            if (response.token) {
                this.setToken(response.token);
                window.StateManager.setUser(response.user);
                window.EventBus.emit(window.Events.AUTH_REGISTER_SUCCESS, response.user);
            }
            
            return response;
        } catch (error) {
            window.EventBus.emit(window.Events.AUTH_REGISTER_FAILED, error.message);
            throw error;
        }
    }

    async logout() {
        try {
            await this.post('/auth/logout');
        } catch (error) {
            console.warn('Logout API call failed:', error);
        } finally {
            this.token = null;
            window.StateManager.logout();
        }
    }

    // API методы для листов доходов
    async getIncomeSheets() {
        return this.get('/income-sheets');
    }

    async createIncomeSheet(sheet) {
        return this.post('/income-sheets', sheet);
    }

    async updateIncomeSheet(id, updates) {
        return this.put(`/income-sheets/${id}`, updates);
    }

    async deleteIncomeSheet(id) {
        return this.delete(`/income-sheets/${id}`);
    }

    // API методы для расходов
    async getExpenses(sheetId) {
        return this.get(`/expenses/${sheetId}`);
    }

    async createExpense(expense) {
        return this.post('/expenses', expense);
    }

    async updateExpense(id, updates) {
        return this.put(`/expenses/${id}`, updates);
    }

    async deleteExpense(id) {
        return this.delete(`/expenses/${id}`);
    }

    // Метод для проверки подключения к серверу
    async healthCheck() {
        try {
            return await this.get('/health');
        } catch (error) {
            console.warn('Server health check failed, working in offline mode');
            return { status: 'offline' };
        }
    }

    // Симуляция API для демо-режима (когда сервер недоступен)
    enableDemoMode() {
        console.warn('API Server not available, enabling demo mode');
        
        // Переопределяем методы для работы с локальными данными
        this.login = async (email, password) => {
            // Простая проверка
            if (email && password) {
                const user = { id: 1, email };
                window.StateManager.setUser(user);
                window.EventBus.emit(window.Events.AUTH_LOGIN_SUCCESS, user);
                return { user, token: 'demo-token' };
            } else {
                throw new Error('Неверные учетные данные');
            }
        };

        this.register = async (email, password, verificationDate) => {
            // Проверяем вчерашнюю дату
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const expectedDate = yesterday.toISOString().split('T')[0];
            
            if (verificationDate !== expectedDate) {
                throw new Error('Неверная дата верификации');
            }
            
            const user = { id: 1, email };
            window.StateManager.setUser(user);
            window.EventBus.emit(window.Events.AUTH_REGISTER_SUCCESS, user);
            return { user, token: 'demo-token' };
        };

        // Остальные методы работают с StateManager
        this.getIncomeSheets = async () => {
            return { sheets: window.StateManager.getState('incomeSheets') };
        };

        this.createIncomeSheet = async (sheet) => {
            const newSheet = window.StateManager.addIncomeSheet(sheet);
            return { sheet: newSheet };
        };

        this.updateIncomeSheet = async (id, updates) => {
            window.StateManager.updateIncomeSheet(id, updates);
            return { success: true };
        };

        this.deleteIncomeSheet = async (id) => {
            window.StateManager.deleteIncomeSheet(id);
            return { success: true };
        };

        this.getExpenses = async (sheetId) => {
            return { expenses: window.StateManager.getSheetExpenses(sheetId) };
        };

        this.createExpense = async (expense) => {
            const newExpense = window.StateManager.addExpense(expense.sheetId, expense);
            return { expense: newExpense };
        };

        this.updateExpense = async (id, updates) => {
            // Находим расход по всем листам
            const sheets = window.StateManager.getState('incomeSheets');
            for (const sheet of sheets) {
                const expenses = window.StateManager.getSheetExpenses(sheet.id);
                if (expenses.some(e => e.id === id)) {
                    window.StateManager.updateExpense(sheet.id, id, updates);
                    break;
                }
            }
            return { success: true };
        };

        this.deleteExpense = async (id) => {
            // Находим и удаляем расход
            const sheets = window.StateManager.getState('incomeSheets');
            for (const sheet of sheets) {
                const expenses = window.StateManager.getSheetExpenses(sheet.id);
                if (expenses.some(e => e.id === id)) {
                    window.StateManager.deleteExpense(sheet.id, id);
                    break;
                }
            }
            return { success: true };
        };
    }
}

// Создаем глобальный экземпляр APIClient
window.APIClient = new APIClient();

// Проверяем доступность сервера при загрузке
window.APIClient.healthCheck().then(response => {
    if (response.status === 'offline') {
        window.APIClient.enableDemoMode();
    }
});

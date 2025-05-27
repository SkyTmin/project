// APIClient.js - HTTP клиент для работы с API
class APIClient {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('auth_token');
    }

    // Установка токена
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    // Получение токена
    getToken() {
        return this.token;
    }

    // Базовый метод для запросов
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        // Добавляем токен, если есть
        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            // Обработка ошибок
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP error! status: ${response.status}`);
            }

            // Проверяем, есть ли контент
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return response;
        } catch (error) {
            // Если токен истек, очищаем его
            if (error.message.includes('401')) {
                this.setToken(null);
                window.EventBus.emit('auth:logout');
            }
            throw error;
        }
    }

    // GET запрос
    get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, {
            method: 'GET'
        });
    }

    // POST запрос
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT запрос
    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE запрос
    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // Методы для аутентификации
    auth = {
        register: (data) => this.post('/auth/register', data),
        login: (data) => this.post('/auth/login', data),
        logout: () => this.post('/auth/logout'),
        verify: () => this.get('/auth/verify')
    };

    // Методы для листов доходов
    incomeSheets = {
        getAll: () => this.get('/income-sheets'),
        get: (id) => this.get(`/income-sheets/${id}`),
        create: (data) => this.post('/income-sheets', data),
        update: (id, data) => this.put(`/income-sheets/${id}`, data),
        delete: (id) => this.delete(`/income-sheets/${id}`)
    };

    // Методы для расходов
    expenses = {
        getBySheet: (sheetId) => this.get(`/expenses/${sheetId}`),
        create: (data) => this.post('/expenses', data),
        update: (id, data) => this.put(`/expenses/${id}`, data),
        delete: (id) => this.delete(`/expenses/${id}`)
    };
}

// Создаем глобальный экземпляр
window.APIClient = new APIClient();
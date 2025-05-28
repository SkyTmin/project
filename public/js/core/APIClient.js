// APIClient.js - HTTP клиент для работы с API
class APIClient {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        this.headers = {
            'Content-Type': 'application/json'
        };
    }

    // Установка токена авторизации
    setAuthToken(token) {
        if (token) {
            this.headers['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.headers['Authorization'];
        }
    }

    // Базовый метод для запросов
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw {
                    status: response.status,
                    message: data.error || 'Ошибка сервера',
                    data
                };
            }

            return data;
        } catch (error) {
            if (error.status === 401) {
                // Токен истек или недействителен
                window.eventBus.emit('auth:logout');
            }
            throw error;
        }
    }

    // GET запрос
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
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
        return this.request(endpoint, { method: 'DELETE' });
    }

    // API методы для аутентификации
    auth = {
        register: (data) => this.post('/auth/register', data),
        login: (data) => this.post('/auth/login', data),
        logout: () => this.post('/auth/logout'),
        verify: () => this.get('/auth/verify')
    };

    // API методы для листов доходов
    incomeSheets = {
        getAll: () => this.get('/income-sheets'),
        create: (data) => this.post('/income-sheets', data),
        update: (id, data) => this.put(`/income-sheets/${id}`, data),
        delete: (id) => this.delete(`/income-sheets/${id}`)
    };

    // API методы для расходов
    expenses = {
        getBySheet: (sheetId) => this.get(`/expenses/${sheetId}`),
        create: (data) => this.post('/expenses', data),
        update: (id, data) => this.put(`/expenses/${id}`, data),
        delete: (id) => this.delete(`/expenses/${id}`)
    };
}

// Создаем глобальный экземпляр
window.apiClient = new APIClient();
(function() {
    'use strict';
    
    class APIClient {
    constructor() {
        this.baseURL = window.location.origin + '/api';
        this.headers = { 'Content-Type': 'application/json' };
    }
    
    setAuthToken(token) {
        if (token) {
            this.headers['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.headers['Authorization'];
        }
    }
    
    async request(endpoint, options = {}) {
        const config = {
            ...options,
            headers: { ...this.headers, ...options.headers }
        };
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
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
                window.eventBus.emit('auth:logout');
            }
            throw error;
        }
    }
    
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }
    
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
    
    auth = {
        register: (data) => this.post('/auth/register', data),
        login: (data) => this.post('/auth/login', data),
        logout: () => this.post('/auth/logout'),
        verify: () => this.get('/auth/verify')
    };
    
    incomeSheets = {
        getAll: () => this.get('/income-sheets'),
        create: (data) => this.post('/income-sheets', data),
        update: (id, data) => this.put(`/income-sheets/${id}`, data),
        delete: (id) => this.delete(`/income-sheets/${id}`)
    };
    
    expenses = {
        getBySheet: (sheetId) => this.get(`/expenses/${sheetId}`),
        create: (data) => this.post('/expenses', data),
        update: (id, data) => this.put(`/expenses/${id}`, data),
        delete: (id) => this.delete(`/expenses/${id}`)
    };
}

window.apiClient = new APIClient();
})();

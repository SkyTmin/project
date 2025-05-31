(function() {
    'use strict';
    
    const AuthModule = {
    id: 'auth',
    name: 'Authentication',
    version: '1.0.0',
    
    init() {
        if (this.initialized) return;
        
        this.setupEventListeners();
        this.setupFormHandlers();
        this.initialized = true;
    },
    
    render() {
        document.getElementById('main-nav').classList.add('hidden');
        document.getElementById('auth-module').classList.remove('hidden');
        document.getElementById('coco-money-module').classList.add('hidden');
    },
    
    setupEventListeners() {
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });
        
        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });
        
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });
        
        window.eventBus.on('auth:logout', () => this.logout());
    },
    
    setupFormHandlers() {
        const forms = {
            'login-form': (e) => this.handleLogin(e.target),
            'register-form': (e) => this.handleRegister(e.target)
        };
        
        Object.entries(forms).forEach(([id, handler]) => {
            document.getElementById(id).addEventListener('submit', async (e) => {
                e.preventDefault();
                await handler(e);
            });
        });
    },
    
    showRegisterForm() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    },
    
    showLoginForm() {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    },
    
    async handleLogin(form) {
        const formData = new FormData(form);
        const data = {
            email: formData.get('login-email'),
            password: formData.get('login-password'),
            rememberDevice: formData.get('remember-device') === 'on'
        };
        
        this.showLoader(true);
        
        try {
            const response = await window.apiClient.auth.login(data);
            
            window.stateManager.setState('user', response.user);
            window.stateManager.setState('token', response.token);
            window.apiClient.setAuthToken(response.token);
            
            this.showToast('Вход выполнен успешно', 'success');
            
            setTimeout(() => {
                window.router.navigate('/home');
            }, 100);
        } catch (error) {
            this.showToast(error.message || 'Ошибка входа', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    async handleRegister(form) {
        const formData = new FormData(form);
        const verificationDate = formData.get('register-date');
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const inputDate = new Date(verificationDate);
        
        if (inputDate.toDateString() !== yesterday.toDateString()) {
            this.showToast('Пожалуйста, введите вчерашнюю дату', 'error');
            return;
        }
        
        const data = {
            email: formData.get('register-email'),
            password: formData.get('register-password'),
            verification_date: verificationDate
        };
        
        this.showLoader(true);
        
        try {
            const response = await window.apiClient.auth.register(data);
            
            window.stateManager.setState('user', response.user);
            window.stateManager.setState('token', response.token);
            window.apiClient.setAuthToken(response.token);
            
            this.showToast('Регистрация выполнена успешно', 'success');
            window.router.navigate('/home');
        } catch (error) {
            this.showToast(error.message || 'Ошибка регистрации', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    async logout() {
        this.showLoader(true);
        
        try {
            await window.apiClient.auth.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        window.stateManager.clear();
        window.apiClient.setAuthToken(null);
        
        window.router.navigate('/');
        
        this.showLoader(false);
        this.showToast('Вы вышли из системы', 'success');
    },
    
    async checkAuth() {
        const token = window.stateManager.getState('token');
        if (!token) return false;
        
        try {
            const response = await window.apiClient.auth.verify();
            window.stateManager.setState('user', response.user);
            return true;
        } catch (error) {
            window.stateManager.clear();
            window.apiClient.setAuthToken(null);
            return false;
        }
    },
    
    showLoader(show) {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.toggle('hidden', !show);
    },
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

window.moduleManager.register(AuthModule);
})();

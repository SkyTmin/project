// AuthModule.js - Модуль аутентификации
const AuthModule = {
    id: 'auth',
    name: 'Authentication',
    version: '1.0.0',
    
    // Инициализация модуля
    init() {
        // Проверяем, что модуль еще не инициализирован
        if (this.initialized) return;
        
        this.setupEventListeners();
        this.setupFormHandlers();
        this.initialized = true;
    },
    
    // Рендеринг модуля
    render() {
        // Скрываем навигацию
        document.getElementById('main-nav').classList.add('hidden');
        
        // Показываем модуль аутентификации
        document.getElementById('auth-module').classList.remove('hidden');
        document.getElementById('coco-money-module').classList.add('hidden');
    },
    
    // Настройка обработчиков событий
    setupEventListeners() {
        // Переключение между формами
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });
        
        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });
        
        // Обработка выхода
        window.eventBus.on('auth:logout', () => this.logout());
    },
    
    // Настройка обработчиков форм
    setupFormHandlers() {
        // Форма входа
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin(e.target);
        });
        
        // Форма регистрации
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister(e.target);
        });
        
        // Кнопка выхода
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });
    },
    
    // Показать форму регистрации
    showRegisterForm() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    },
    
    // Показать форму входа
    showLoginForm() {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    },
    
    // Обработка входа
    async handleLogin(form) {
        const email = form.elements['login-email'].value;
        const password = form.elements['login-password'].value;
        const rememberDevice = form.elements['remember-device'].checked;
        
        this.showLoader(true);
        
        try {
            const response = await window.apiClient.auth.login({
                email,
                password,
                rememberDevice
            });
            
            // Сохраняем данные пользователя
            window.stateManager.setState('user', response.user);
            window.stateManager.setState('token', response.token);
            window.apiClient.setAuthToken(response.token);
            
            // Показываем уведомление
            this.showToast('Вход выполнен успешно', 'success');
            
            // Переходим к основному приложению
            window.router.navigate('/home');
        } catch (error) {
            this.showToast(error.message || 'Ошибка входа', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Обработка регистрации
    async handleRegister(form) {
        const email = form.elements['register-email'].value;
        const password = form.elements['register-password'].value;
        const verificationDate = form.elements['register-date'].value;
        
        // Проверяем, что введена вчерашняя дата
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const inputDate = new Date(verificationDate);
        
        if (inputDate.toDateString() !== yesterday.toDateString()) {
            this.showToast('Пожалуйста, введите вчерашнюю дату', 'error');
            return;
        }
        
        this.showLoader(true);
        
        try {
            const response = await window.apiClient.auth.register({
                email,
                password,
                verification_date: verificationDate
            });
            
            // Сохраняем данные пользователя
            window.stateManager.setState('user', response.user);
            window.stateManager.setState('token', response.token);
            window.apiClient.setAuthToken(response.token);
            
            // Показываем уведомление
            this.showToast('Регистрация выполнена успешно', 'success');
            
            // Переходим к основному приложению
            window.router.navigate('/home');
        } catch (error) {
            this.showToast(error.message || 'Ошибка регистрации', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Выход из системы
    async logout() {
        this.showLoader(true);
        
        try {
            await window.apiClient.auth.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        // Очищаем состояние
        window.stateManager.clear();
        window.apiClient.setAuthToken(null);
        
        // Переходим к форме входа
        window.router.navigate('/');
        
        this.showLoader(false);
        this.showToast('Вы вышли из системы', 'success');
    },
    
    // Проверка аутентификации
    async checkAuth() {
        const token = window.stateManager.getState('token');
        if (!token) return false;
        
        try {
            const response = await window.apiClient.auth.verify();
            window.stateManager.setState('user', response.user);
            return true;
        } catch (error) {
            // Токен недействителен
            window.stateManager.clear();
            window.apiClient.setAuthToken(null);
            return false;
        }
    },
    
    // Показать/скрыть индикатор загрузки
    showLoader(show) {
        const loader = document.getElementById('loader');
        if (show) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }
    },
    
    // Показать уведомление
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Регистрируем модуль
window.moduleManager.register(AuthModule);

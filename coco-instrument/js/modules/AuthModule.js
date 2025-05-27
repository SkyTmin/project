/**
 * AuthModule - Модуль аутентификации
 */
const AuthModule = {
    id: 'auth',
    name: 'Authentication Module',
    version: '1.0.0',
    dependencies: [],

    // DOM элементы
    elements: {},
    
    // Состояние модуля
    state: {
        isLoginMode: true
    },

    /**
     * Инициализация модуля
     */
    async init() {
        console.log('Initializing AuthModule...');
        
        this.bindElements();
        this.attachEventListeners();
        this.setupEventHandlers();
        
        // Устанавливаем вчерашнюю дату по умолчанию
        this.setYesterdayDate();
    },

    /**
     * Привязка DOM элементов
     */
    bindElements() {
        this.elements = {
            authModule: document.getElementById('auth-module'),
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            loginFormElement: document.getElementById('login-form-element'),
            registerFormElement: document.getElementById('register-form-element'),
            
            // Login form fields
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            
            // Register form fields
            registerEmail: document.getElementById('register-email'),
            registerPassword: document.getElementById('register-password'),
            registerVerificationDate: document.getElementById('register-verification-date'),
            
            // Switch links
            showRegister: document.getElementById('show-register'),
            showLogin: document.getElementById('show-login')
        };
    },

    /**
     * Подключение обработчиков событий
     */
    attachEventListeners() {
        // Обработчики форм
        this.elements.loginFormElement.addEventListener('submit', this.handleLogin.bind(this));
        this.elements.registerFormElement.addEventListener('submit', this.handleRegister.bind(this));
        
        // Переключение между формами
        this.elements.showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });
        
        this.elements.showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });
    },

    /**
     * Настройка обработчиков событий приложения
     */
    setupEventHandlers() {
        // Обработчики успешной аутентификации
        window.EventBus.on(window.Events.AUTH_LOGIN_SUCCESS, this.onAuthSuccess.bind(this));
        window.EventBus.on(window.Events.AUTH_REGISTER_SUCCESS, this.onAuthSuccess.bind(this));
        
        // Обработчики ошибок аутентификации
        window.EventBus.on(window.Events.AUTH_LOGIN_FAILED, this.onAuthError.bind(this));
        window.EventBus.on(window.Events.AUTH_REGISTER_FAILED, this.onAuthError.bind(this));
    },

    /**
     * Установить вчерашнюю дату
     */
    setYesterdayDate() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateString = yesterday.toISOString().split('T')[0];
        this.elements.registerVerificationDate.value = dateString;
    },

    /**
     * Обработчик входа в систему
     */
    async handleLogin(event) {
        event.preventDefault();
        
        const email = this.elements.loginEmail.value.trim();
        const password = this.elements.loginPassword.value;
        
        if (!email || !password) {
            this.showError('Пожалуйста, заполните все поля');
            return;
        }

        try {
            this.setFormLoading(this.elements.loginForm, true);
            await window.APIClient.login(email, password);
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            this.setFormLoading(this.elements.loginForm, false);
        }
    },

    /**
     * Обработчик регистрации
     */
    async handleRegister(event) {
        event.preventDefault();
        
        const email = this.elements.registerEmail.value.trim();
        const password = this.elements.registerPassword.value;
        const verificationDate = this.elements.registerVerificationDate.value;
        
        if (!email || !password || !verificationDate) {
            this.showError('Пожалуйста, заполните все поля');
            return;
        }

        // Проверяем email
        if (!this.isValidEmail(email)) {
            this.showError('Пожалуйста, введите корректный email адрес');
            return;
        }

        // Проверяем пароль
        if (password.length < 6) {
            this.showError('Пароль должен содержать минимум 6 символов');
            return;
        }

        // Проверяем дату верификации
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const expectedDate = yesterday.toISOString().split('T')[0];
        
        if (verificationDate !== expectedDate) {
            this.showError('Пожалуйста, укажите вчерашнюю дату');
            return;
        }

        try {
            this.setFormLoading(this.elements.registerForm, true);
            await window.APIClient.register(email, password, verificationDate);
        } catch (error) {
            console.error('Register error:', error);
        } finally {
            this.setFormLoading(this.elements.registerForm, false);
        }
    },

    /**
     * Показать форму входа
     */
    showLoginForm() {
        this.state.isLoginMode = true;
        this.elements.loginForm.classList.remove('hidden');
        this.elements.registerForm.classList.add('hidden');
        this.clearMessages();
        this.clearForms();
    },

    /**
     * Показать форму регистрации
     */
    showRegisterForm() {
        this.state.isLoginMode = false;
        this.elements.loginForm.classList.add('hidden');
        this.elements.registerForm.classList.remove('hidden');
        this.clearMessages();
        this.clearForms();
        this.setYesterdayDate();
    },

    /**
     * Обработчик успешной аутентификации
     */
    onAuthSuccess(user) {
        this.showSuccess('Добро пожаловать!');
        this.clearForms();
        
        // Переходим к главному приложению
        setTimeout(() => {
            this.hide();
            window.ModuleManager.activateModule('coco-money');
        }, 1000);
    },

    /**
     * Обработчик ошибки аутентификации
     */
    onAuthError(errorMessage) {
        this.showError(errorMessage || 'Произошла ошибка при аутентификации');
    },

    /**
     * Установить состояние загрузки формы
     */
    setFormLoading(form, isLoading) {
        if (isLoading) {
            form.classList.add('loading');
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Загрузка...';
            }
        } else {
            form.classList.remove('loading');
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = this.state.isLoginMode ? 'Войти' : 'Зарегистрироваться';
            }
        }
    },

    /**
     * Показать сообщение об ошибке
     */
    showError(message) {
        this.clearMessages();
        const activeForm = this.state.isLoginMode ? this.elements.loginForm : this.elements.registerForm;
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        activeForm.insertBefore(errorDiv, activeForm.querySelector('form'));
    },

    /**
     * Показать сообщение об успехе
     */
    showSuccess(message) {
        this.clearMessages();
        const activeForm = this.state.isLoginMode ? this.elements.loginForm : this.elements.registerForm;
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        activeForm.insertBefore(successDiv, activeForm.querySelector('form'));
    },

    /**
     * Очистить сообщения
     */
    clearMessages() {
        const messages = this.elements.authModule.querySelectorAll('.error-message, .success-message');
        messages.forEach(msg => msg.remove());
    },

    /**
     * Очистить формы
     */
    clearForms() {
        this.elements.loginFormElement.reset();
        this.elements.registerFormElement.reset();
        this.setYesterdayDate();
    },

    /**
     * Проверить корректность email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Показать модуль
     */
    show() {
        this.elements.authModule.classList.remove('hidden');
        
        // Проверяем, есть ли сохраненный пользователь
        const user = window.StateManager.getState('user');
        if (user && window.StateManager.getState('isAuthenticated')) {
            // Пользователь уже аутентифицирован, переходим к приложению
            this.hide();
            window.ModuleManager.activateModule('coco-money');
        }
    },

    /**
     * Скрыть модуль
     */
    hide() {
        this.elements.authModule.classList.add('hidden');
    },

    /**
     * Уничтожить модуль
     */
    destroy() {
        // Отписываемся от событий
        this.elements.loginFormElement.removeEventListener('submit', this.handleLogin);
        this.elements.registerFormElement.removeEventListener('submit', this.handleRegister);
        
        window.EventBus.off(window.Events.AUTH_LOGIN_SUCCESS, this.onAuthSuccess);
        window.EventBus.off(window.Events.AUTH_REGISTER_SUCCESS, this.onAuthSuccess);
        window.EventBus.off(window.Events.AUTH_LOGIN_FAILED, this.onAuthError);
        window.EventBus.off(window.Events.AUTH_REGISTER_FAILED, this.onAuthError);
    }
};

// Регистрируем модуль
window.ModuleManager.register(AuthModule);
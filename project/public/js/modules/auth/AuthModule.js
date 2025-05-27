// AuthModule.js - Модуль аутентификации
const AuthModule = {
    id: 'auth',
    name: 'Аутентификация',
    version: '1.0.0',
    
    // Инициализация модуля
    init() {
        this.checkAuth();
    },

    // Проверка аутентификации
    async checkAuth() {
        const token = window.APIClient.getToken();
        if (token) {
            try {
                const user = await window.APIClient.auth.verify();
                window.StateManager.setState('user', user);
                window.EventBus.emit('auth:verified', user);
            } catch (error) {
                window.APIClient.setToken(null);
                window.StateManager.setState('user', null);
            }
        }
    },

    // Отрисовка формы входа
    renderLogin() {
        const container = document.getElementById('app-container');
        container.innerHTML = `
            <div class="auth-container">
                <form class="auth-form" id="login-form">
                    <h2>Вход в систему</h2>
                    <div id="auth-error" class="auth-error" style="display: none;"></div>
                    
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Пароль</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    
                    <div class="remember-device">
                        <input type="checkbox" id="remember" name="remember">
                        <label for="remember">Запомнить устройство</label>
                    </div>
                    
                    <button type="submit" class="btn">Войти</button>
                    
                    <div class="auth-switch">
                        Нет аккаунта? <a href="#" id="show-register">Зарегистрироваться</a>
                    </div>
                </form>
            </div>
        `;

        // Обработчики
        document.getElementById('login-form').addEventListener('submit', this.handleLogin.bind(this));
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.renderRegister();
        });
    },

    // Отрисовка формы регистрации
    renderRegister() {
        const container = document.getElementById('app-container');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        container.innerHTML = `
            <div class="auth-container">
                <form class="auth-form" id="register-form">
                    <h2>Регистрация</h2>
                    <div id="auth-error" class="auth-error" style="display: none;"></div>
                    
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Пароль</label>
                        <input type="password" id="password" name="password" required minlength="6">
                    </div>
                    
                    <div class="form-group">
                        <label for="verification_date">Вчерашняя дата (для проверки)</label>
                        <input type="date" id="verification_date" name="verification_date" required>
                        <div class="verification-hint">Введите вчерашнюю дату</div>
                    </div>
                    
                    <div class="remember-device">
                        <input type="checkbox" id="remember" name="remember" checked>
                        <label for="remember">Запомнить устройство</label>
                    </div>
                    
                    <button type="submit" class="btn">Зарегистрироваться</button>
                    
                    <div class="auth-switch">
                        Уже есть аккаунт? <a href="#" id="show-login">Войти</a>
                    </div>
                </form>
            </div>
        `;

        // Обработчики
        document.getElementById('register-form').addEventListener('submit', this.handleRegister.bind(this));
        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.renderLogin();
        });
    },

    // Обработка входа
    async handleLogin(e) {
        e.preventDefault();
        const form = e.target;
        const errorDiv = document.getElementById('auth-error');
        
        try {
            const data = {
                email: form.email.value,
                password: form.password.value,
                remember: form.remember.checked
            };

            const response = await window.APIClient.auth.login(data);
            
            // Сохраняем токен
            window.APIClient.setToken(response.token);
            window.StateManager.setState('user', response.user);
            
            // Уведомляем о входе
            window.EventBus.emit('auth:login', response.user);
            
            // Переходим на главную
            window.Router.navigate('/');
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    },

    // Обработка регистрации
    async handleRegister(e) {
        e.preventDefault();
        const form = e.target;
        const errorDiv = document.getElementById('auth-error');
        
        // Проверяем вчерашнюю дату
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const inputDate = new Date(form.verification_date.value);
        
        if (inputDate.toDateString() !== yesterday.toDateString()) {
            errorDiv.textContent = 'Неверная дата. Введите вчерашнюю дату.';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            const data = {
                email: form.email.value,
                password: form.password.value,
                verification_date: form.verification_date.value,
                remember: form.remember.checked
            };

            const response = await window.APIClient.auth.register(data);
            
            // Сохраняем токен
            window.APIClient.setToken(response.token);
            window.StateManager.setState('user', response.user);
            
            // Уведомляем о регистрации
            window.EventBus.emit('auth:register', response.user);
            
            // Переходим на главную
            window.Router.navigate('/');
            
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    },

    // Выход
    async logout() {
        try {
            await window.APIClient.auth.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            window.APIClient.setToken(null);
            window.StateManager.clear();
            window.EventBus.emit('auth:logout');
            window.Router.navigate('/auth/login');
        }
    },

    // Маршруты модуля
    routes: {
        '/auth/login': function() {
            this.renderLogin();
        },
        '/auth/register': function() {
            this.renderRegister();
        }
    },

    // События модуля
    events: {
        'auth:logout': function() {
            this.logout();
        }
    }
};

// Регистрируем модуль
window.ModuleManager.register(AuthModule);
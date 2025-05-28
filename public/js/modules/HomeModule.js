// HomeModule.js - Модуль главной страницы
const HomeModule = {
    id: 'home',
    name: 'Home',
    version: '1.0.0',
    
    // Инициализация модуля
    init() {
        // Проверяем, что модуль еще не инициализирован
        if (this.initialized) return;
        this.initialized = true;
    },
    
    // Рендеринг модуля
    render() {
        // Показываем навигацию
        const nav = document.getElementById('main-nav');
        nav.classList.remove('hidden');
        
        // Обновляем email пользователя
        const user = window.stateManager.getState('user');
        if (user) {
            document.getElementById('user-email').textContent = user.email;
        }
        
        // Скрываем другие модули и показываем главную страницу
        document.getElementById('auth-module').classList.add('hidden');
        document.getElementById('coco-money-module').classList.add('hidden');
        document.getElementById('home-module').classList.remove('hidden');
    }
};

// Регистрируем модуль
window.moduleManager.register(HomeModule);
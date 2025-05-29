// HomeModule.js - Модуль главной страницы
const HomeModule = {
    id: 'home',
    name: 'Home',
    version: '1.0.0',
    
    // Инициализация модуля
    init() {
        // Проверяем, что модуль еще не инициализирован
        if (this.initialized) return;
        
        this.setupEventListeners();
        this.initialized = true;
    },
    
    // Настройка обработчиков событий
    setupEventListeners() {
        // Поиск инструментов
        const searchInput = document.getElementById('tool-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTools(e.target.value);
            });
        }
    },
    
    // Поиск инструментов
    searchTools(query) {
        const toolsGrid = document.getElementById('tools-grid');
        const noResults = document.getElementById('no-results');
        const tools = toolsGrid.querySelectorAll('.tool-card');
        
        if (!query.trim()) {
            // Показываем все инструменты
            tools.forEach(tool => tool.style.display = '');
            noResults.classList.add('hidden');
            return;
        }
        
        const searchQuery = query.toLowerCase();
        let hasResults = false;
        
        tools.forEach(tool => {
            const name = tool.getAttribute('data-tool-name').toLowerCase();
            const desc = tool.getAttribute('data-tool-desc').toLowerCase();
            
            if (name.includes(searchQuery) || desc.includes(searchQuery)) {
                tool.style.display = '';
                hasResults = true;
            } else {
                tool.style.display = 'none';
            }
        });
        
        // Показываем/скрываем сообщение "не найдено"
        if (hasResults) {
            noResults.classList.add('hidden');
        } else {
            noResults.classList.remove('hidden');
        }
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
        
        // Скрываем полноэкранный вид листа если он открыт
        document.getElementById('sheet-fullscreen').classList.add('hidden');
        
        // Очищаем поиск
        const searchInput = document.getElementById('tool-search');
        if (searchInput) {
            searchInput.value = '';
            this.searchTools('');
        }
    }
};

// Регистрируем модуль
window.moduleManager.register(HomeModule);

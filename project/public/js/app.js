// app.js - Точка входа приложения
class App {
    constructor() {
        this.initialized = false;
    }

    // Инициализация приложения
    async init() {
        if (this.initialized) return;

        console.log('Initializing Coco Instrument...');

        // Восстанавливаем состояние
        window.StateManager.restore('coco_state');

        // Настраиваем маршруты
        this.setupRoutes();

        // Настраиваем обработчики событий
        this.setupEventHandlers();

        // Проверяем аутентификацию
        await this.checkAuthentication();

        // Обрабатываем текущий маршрут
        window.Router.handleRoute();

        // Сохраняем состояние при изменениях
        window.StateManager.subscribe('', () => {
            window.StateManager.persist('coco_state');
        });

        this.initialized = true;
        console.log('Coco Instrument initialized');
    }

    // Настройка маршрутов
    setupRoutes() {
        // Главная страница
        window.Router.register('/', () => {
            const user = window.StateManager.getState('user');
            if (user) {
                window.Router
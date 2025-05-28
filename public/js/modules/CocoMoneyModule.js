// CocoMoneyModule.js - Модуль управления финансами
const CocoMoneyModule = {
    id: 'coco-money',
    name: 'Coco Money',
    version: '1.0.0',
    
    // Инициализация модуля
    init() {
        this.setupEventListeners();
        this.setupFormHandlers();
        this.subscribeToState();
    },
    
    // Активация модуля
    async activate() {
        // Загружаем данные с сервера
        await this.loadData();
        
        // Показываем интерфейс
        this.render();
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
        
        // Скрываем модуль аутентификации и показываем Coco Money
        document.getElementById('auth-module').classList.add('hidden');
        document.getElementById('coco-money-module').classList.remove('hidden');
        
        // Рендерим вкладки и контент
        this.renderTabs();
        this.renderActiveSheet();
        this.updateBalance();
    },
    
    // Подписка на изменения состояния
    subscribeToState() {
        // Подписываемся на изменения листов доходов
        window.stateManager.subscribe('incomeSheets', () => {
            this.renderTabs();
            this.updateBalance();
        });
        
        // Подписываемся на изменение активного листа
        window.stateManager.subscribe('activeSheetId', () => {
            this.renderActiveSheet();
        });
        
        // Подписываемся на изменения расходов
        window.stateManager.subscribe('expenses', () => {
            this.renderExpenses();
            this.updateBalance();
            this.updateSheetInfo();
        });
    },
    
    // Настройка обработчиков событий
    setupEventListeners() {
        // Кнопка добавления листа
        document.getElementById('add-sheet-btn').addEventListener('click', () => {
            this.showNewSheetModal();
        });
        
        // Кнопка редактирования листа
        document.getElementById('edit-sheet-btn').addEventListener('click', () => {
            this.showEditForm();
        });
        
        // Кнопки сохранения/отмены редактирования
        document.getElementById('save-sheet-btn').addEventListener('click', () => {
            this.saveSheet();
        });
        
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.hideEditForm();
        });
        
        document.getElementById('delete-sheet-btn').addEventListener('click', () => {
            this.deleteSheet();
        });
        
        // Закрытие модального окна
        document.getElementById('cancel-new-sheet').addEventListener('click', () => {
            this.hideNewSheetModal();
        });
    },
    
    // Настройка обработчиков форм
    setupFormHandlers() {
        // Форма создания нового листа
        document.getElementById('new-sheet-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createSheet(e.target);
        });
        
        // Форма добавления расхода
        document.getElementById('add-expense-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.addExpense(e.target);
        });
    },
    
    // Загрузка данных с сервера
    async loadData() {
        this.showLoader(true);
        
        try {
            // Загружаем листы доходов
            const sheets = await window.apiClient.incomeSheets.getAll();
            window.stateManager.setState('incomeSheets', sheets);
            
            // Если есть листы, активируем первый
            if (sheets.length > 0) {
                window.stateManager.setState('activeSheetId', sheets[0].id);
                
                // Загружаем расходы для всех листов
                const allExpenses = [];
                for (const sheet of sheets) {
                    const expenses = await window.apiClient.expenses.getBySheet(sheet.id);
                    allExpenses.push(...expenses);
                }
                window.stateManager.setState('expenses', allExpenses);
            }
        } catch (error) {
            this.showToast('Ошибка загрузки данных', 'error');
            console.error('Load data error:', error);
        } finally {
            this.showLoader(false);
        }
    },
    
    // Рендеринг вкладок
    renderTabs() {
        const container = document.getElementById('tabs-container');
        const sheets = window.stateManager.getState('incomeSheets');
        const activeSheetId = window.stateManager.getState('activeSheetId');
        
        container.innerHTML = '';
        
        sheets.forEach(sheet => {
            const tab = document.createElement('button');
            tab.className = `income-tab ${sheet.id === activeSheetId ? 'active' : ''}`;
            tab.innerHTML = `
                <span>${sheet.name}</span>
                <button class="tab-close" data-sheet-id="${sheet.id}">×</button>
            `;
            
            // Клик по вкладке
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tab-close')) {
                    window.stateManager.setState('activeSheetId', sheet.id);
                }
            });
            
            // Закрытие вкладки
            tab.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirmDeleteSheet(sheet.id);
            });
            
            container.appendChild(tab);
        });
    },
    
    // Рендеринг активного листа
    renderActiveSheet() {
        const sheet = window.stateManager.getActiveSheet();
        
        if (!sheet) {
            document.getElementById('sheet-info').classList.add('hidden');
            document.getElementById('expenses-section').classList.add('hidden');
            document.getElementById('edit-sheet-btn').classList.add('hidden');
            document.getElementById('sheet-name').textContent = 'Создайте первый лист доходов';
            return;
        }
        
        // Показываем информацию о листе
        document.getElementById('sheet-info').classList.remove('hidden');
        document.getElementById('expenses-section').classList.remove('hidden');
        document.getElementById('edit-sheet-btn').classList.remove('hidden');
        
        // Обновляем информацию
        this.updateSheetInfo();
        this.renderExpenses();
    },
    
    // Обновление информации о листе
    updateSheetInfo() {
        const sheet = window.stateManager.getActiveSheet();
        if (!sheet) return;
        
        const expenses = window.stateManager.getActiveSheetExpenses();
        const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const balance = parseFloat(sheet.income_amount) - totalExpenses;
        
        document.getElementById('sheet-name').textContent = sheet.name;
        document.getElementById('sheet-income').textContent = `${this.formatMoney(sheet.income_amount)} ₽`;
        document.getElementById('sheet-expenses').textContent = `${this.formatMoney(totalExpenses)} ₽`;
        document.getElementById('sheet-balance').textContent = `${this.formatMoney(balance)} ₽`;
    },
    
    // Рендеринг расходов
    renderExpenses() {
        const container = document.getElementById('expenses-list');
        const expenses = window.stateManager.getActiveSheetExpenses();
        
        container.innerHTML = '';
        
        if (expenses.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Нет расходов</p></div>';
            return;
        }
        
        expenses.forEach(expense => {
            const item = document.createElement('div');
            item.className = 'expense-item';
            item.innerHTML = `
                <div class="expense-info">
                    <div class="expense-amount">${this.formatMoney(expense.amount)} ₽</div>
                    ${expense.note ? `<div class="expense-note">${expense.note}</div>` : ''}
                    <div class="expense-date">${this.formatDate(expense.created_at)}</div>
                </div>
                <div class="expense-actions">
                    <button class="btn-icon delete" data-expense-id="${expense.id}" title="Удалить">
                        🗑️
                    </button>
                </div>
            `;
            
            // Обработчик удаления
            item.querySelector('.delete').addEventListener('click', () => {
                this.deleteExpense(expense.id);
            });
            
            container.appendChild(item);
        });
    },
    
    // Обновление общего баланса
    updateBalance() {
        const totalBalance = window.stateManager.calculateTotalBalance();
        document.getElementById('total-balance').textContent = `${this.formatMoney(totalBalance)} ₽`;
    },
    
    // Показать модальное окно нового листа
    showNewSheetModal() {
        document.getElementById('new-sheet-modal').classList.remove('hidden');
        document.getElementById('new-sheet-name').focus();
        
        // Устанавливаем текущую дату
        document.getElementById('new-sheet-date').value = new Date().toISOString().split('T')[0];
    },
    
    // Скрыть модальное окно нового листа
    hideNewSheetModal() {
        document.getElementById('new-sheet-modal').classList.add('hidden');
        document.getElementById('new-sheet-form').reset();
    },
    
    // Создание нового листа
    async createSheet(form) {
        const name = form.elements['new-sheet-name'].value;
        const income = form.elements['new-sheet-income'].value;
        const date = form.elements['new-sheet-date'].value;
        
        this.showLoader(true);
        
        try {
            const sheet = await window.apiClient.incomeSheets.create({
                name,
                income_amount: parseFloat(income),
                date
            });
            
            // Добавляем в состояние
            const sheets = window.stateManager.getState('incomeSheets');
            sheets.push(sheet);
            window.stateManager.setState('incomeSheets', sheets);
            window.stateManager.setState('activeSheetId', sheet.id);
            
            this.hideNewSheetModal();
            this.showToast('Лист доходов создан', 'success');
        } catch (error) {
            this.showToast('Ошибка создания листа', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Показать форму редактирования
    showEditForm() {
        const sheet = window.stateManager.getActiveSheet();
        if (!sheet) return;
        
        document.getElementById('sheet-info').classList.add('hidden');
        document.getElementById('sheet-edit-form').classList.remove('hidden');
        
        // Заполняем форму текущими данными
        document.getElementById('edit-sheet-name').value = sheet.name;
        document.getElementById('edit-sheet-income').value = sheet.income_amount;
        document.getElementById('edit-sheet-date').value = sheet.date;
    },
    
    // Скрыть форму редактирования
    hideEditForm() {
        document.getElementById('sheet-info').classList.remove('hidden');
        document.getElementById('sheet-edit-form').classList.add('hidden');
    },
    
    // Сохранение изменений листа
    async saveSheet() {
        const sheet = window.stateManager.getActiveSheet();
        if (!sheet) return;
        
        const name = document.getElementById('edit-sheet-name').value;
        const income = document.getElementById('edit-sheet-income').value;
        const date = document.getElementById('edit-sheet-date').value;
        
        this.showLoader(true);
        
        try {
            const updated = await window.apiClient.incomeSheets.update(sheet.id, {
                name,
                income_amount: parseFloat(income),
                date
            });
            
            // Обновляем в состоянии
            const sheets = window.stateManager.getState('incomeSheets');
            const index = sheets.findIndex(s => s.id === sheet.id);
            sheets[index] = updated;
            window.stateManager.setState('incomeSheets', sheets);
            
            this.hideEditForm();
            this.showToast('Изменения сохранены', 'success');
        } catch (error) {
            this.showToast('Ошибка сохранения', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Подтверждение удаления листа
    confirmDeleteSheet(sheetId) {
        if (confirm('Удалить этот лист доходов? Все расходы также будут удалены.')) {
            this.deleteSheet(sheetId);
        }
    },
    
    // Удаление листа
    async deleteSheet(sheetId) {
        const currentSheet = window.stateManager.getActiveSheet();
        sheetId = sheetId || (currentSheet && currentSheet.id);
        
        if (!sheetId) return;
        
        this.showLoader(true);
        
        try {
            await window.apiClient.incomeSheets.delete(sheetId);
            
            // Удаляем из состояния
            const sheets = window.stateManager.getState('incomeSheets').filter(s => s.id !== sheetId);
            const expenses = window.stateManager.getState('expenses').filter(e => e.income_sheet_id !== sheetId);
            
            window.stateManager.setState('incomeSheets', sheets);
            window.stateManager.setState('expenses', expenses);
            
            // Если удалили активный лист, активируем первый
            if (window.stateManager.getState('activeSheetId') === sheetId) {
                window.stateManager.setState('activeSheetId', sheets[0]?.id || null);
            }
            
            this.hideEditForm();
            this.showToast('Лист удален', 'success');
        } catch (error) {
            this.showToast('Ошибка удаления', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Добавление расхода
    async addExpense(form) {
        const sheet = window.stateManager.getActiveSheet();
        if (!sheet) return;
        
        const amount = form.elements['expense-amount'].value;
        const note = form.elements['expense-note'].value;
        
        this.showLoader(true);
        
        try {
            const expense = await window.apiClient.expenses.create({
                income_sheet_id: sheet.id,
                amount: parseFloat(amount),
                note
            });
            
            // Добавляем в состояние
            const expenses = window.stateManager.getState('expenses');
            expenses.push(expense);
            window.stateManager.setState('expenses', expenses);
            
            form.reset();
            this.showToast('Расход добавлен', 'success');
        } catch (error) {
            this.showToast('Ошибка добавления расхода', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Удаление расхода
    async deleteExpense(expenseId) {
        if (!confirm('Удалить этот расход?')) return;
        
        this.showLoader(true);
        
        try {
            await window.apiClient.expenses.delete(expenseId);
            
            // Удаляем из состояния
            const expenses = window.stateManager.getState('expenses').filter(e => e.id !== expenseId);
            window.stateManager.setState('expenses', expenses);
            
            this.showToast('Расход удален', 'success');
        } catch (error) {
            this.showToast('Ошибка удаления расхода', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Утилиты
    formatMoney(amount) {
        return new Intl.NumberFormat('ru-RU').format(amount);
    },
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU');
    },
    
    showLoader(show) {
        const loader = document.getElementById('loader');
        if (show) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }
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

// Регистрируем модуль
window.moduleManager.register(CocoMoneyModule);
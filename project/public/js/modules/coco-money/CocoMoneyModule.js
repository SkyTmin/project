// CocoMoneyModule.js - Модуль управления финансами
const CocoMoneyModule = {
    id: 'coco-money',
    name: 'Coco Money',
    version: '1.0.0',
    
    // Локальное состояние модуля
    state: {
        sheets: [],
        activeSheetId: null,
        editMode: false,
        expenses: {}
    },

    // Инициализация модуля
    async init() {
        await this.loadSheets();
    },

    // Загрузка листов доходов
    async loadSheets() {
        try {
            const sheets = await window.APIClient.incomeSheets.getAll();
            this.state.sheets = sheets;
            window.StateManager.setState('incomeSheets', sheets);
            
            // Загружаем расходы для каждого листа
            for (const sheet of sheets) {
                const expenses = await window.APIClient.expenses.getBySheet(sheet.id);
                this.state.expenses[sheet.id] = expenses;
            }
            
            // Устанавливаем активный лист
            if (sheets.length > 0 && !this.state.activeSheetId) {
                this.state.activeSheetId = sheets[0].id;
            }
        } catch (error) {
            console.error('Error loading sheets:', error);
        }
    },

    // Отрисовка модуля
    render() {
        const container = document.getElementById('app-container');
        
        if (this.state.sheets.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        container.innerHTML = `
            <div class="coco-money-container">
                <div class="tabs-container">
                    <div class="tabs-header">
                        ${this.renderTabs()}
                        <button class="tab tab-add" onclick="CocoMoneyModule.createSheet()">+ Новый лист</button>
                    </div>
                </div>
                <div class="tab-content">
                    ${this.renderActiveSheet()}
                </div>
            </div>
        `;

        // Обработчики событий
        this.attachEventHandlers();
    },

    // Отрисовка вкладок
    renderTabs() {
        return this.state.sheets.map(sheet => `
            <button class="tab ${sheet.id === this.state.activeSheetId ? 'active' : ''}" 
                    data-sheet-id="${sheet.id}"
                    onclick="CocoMoneyModule.switchTab(${sheet.id})">
                ${sheet.name}
                ${this.state.sheets.length > 1 ? `<span class="tab-close" onclick="event.stopPropagation(); CocoMoneyModule.deleteSheet(${sheet.id})">×</span>` : ''}
            </button>
        `).join('');
    },

    // Отрисовка активного листа
    renderActiveSheet() {
        const sheet = this.state.sheets.find(s => s.id === this.state.activeSheetId);
        if (!sheet) return '';

        const expenses = this.state.expenses[sheet.id] || [];
        const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
        const balance = parseFloat(sheet.income_amount) - totalExpenses;

        if (this.state.editMode) {
            return this.renderEditMode(sheet);
        }

        return `
            <div class="sheet-info">
                <div class="info-item">
                    <div class="info-label">Название</div>
                    <div class="info-value">${sheet.name}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Доход</div>
                    <div class="info-value">${this.formatMoney(sheet.income_amount)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Расходы</div>
                    <div class="info-value">${this.formatMoney(totalExpenses)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Баланс</div>
                    <div class="info-value balance ${balance < 0 ? 'negative' : ''}">${this.formatMoney(balance)}</div>
                </div>
            </div>

            <div class="actions-bar">
                <button class="btn" onclick="CocoMoneyModule.enableEditMode()">Редактировать лист</button>
            </div>

            <div class="expenses-section">
                <div class="expenses-header">
                    <h3>Расходы</h3>
                </div>
                
                <form class="expense-form" onsubmit="CocoMoneyModule.addExpense(event)">
                    <div class="expense-form-row">
                        <div class="form-group">
                            <input type="number" step="0.01" name="amount" placeholder="Сумма" required>
                        </div>
                        <div class="form-group">
                            <input type="text" name="note" placeholder="Примечание">
                        </div>
                        <button type="submit" class="btn">Добавить</button>
                    </div>
                </form>

                <div class="expenses-list">
                    ${expenses.length > 0 ? expenses.map(exp => this.renderExpense(exp)).join('') : '<p class="empty-state">Расходов пока нет</p>'}
                </div>
            </div>
        `;
    },

    // Отрисовка режима редактирования
    renderEditMode(sheet) {
        return `
            <form onsubmit="CocoMoneyModule.saveSheet(event)">
                <div class="form-group">
                    <label for="sheet-name">Название листа</label>
                    <input type="text" id="sheet-name" name="name" value="${sheet.name}" required>
                </div>
                <div class="form-group">
                    <label for="sheet-income">Доход</label>
                    <input type="number" step="0.01" id="sheet-income" name="income_amount" value="${sheet.income_amount}" required>
                </div>
                <div class="form-group">
                    <label for="sheet-date">Дата</label>
                    <input type="date" id="sheet-date" name="date" value="${sheet.date}" required>
                </div>
                <div class="edit-actions">
                    <button type="submit" class="btn">Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="CocoMoneyModule.cancelEdit()">Отмена</button>
                </div>
            </form>
        `;
    },

    // Отрисовка расхода
    renderExpense(expense) {
        return `
            <div class="expense-item">
                <div class="expense-info">
                    <div class="expense-amount">${this.formatMoney(expense.amount)}</div>
                    ${expense.note ? `<div class="expense-note">${expense.note}</div>` : ''}
                    <div class="expense-date">${new Date(expense.created_at).toLocaleDateString()}</div>
                </div>
                <div class="expense-actions">
                    <button class="btn btn-small btn-danger" onclick="CocoMoneyModule.deleteExpense(${expense.id})">Удалить</button>
                </div>
            </div>
        `;
    },

    // Отрисовка пустого состояния
    renderEmptyState() {
        return `
            <div class="empty-state">
                <h3>Добро пожаловать в Coco Money!</h3>
                <p>Создайте свой первый лист доходов для начала работы</p>
                <button class="btn" onclick="CocoMoneyModule.createSheet()">Создать лист доходов</button>
            </div>
        `;
    },

    // Переключение вкладок
    switchTab(sheetId) {
        this.state.activeSheetId = sheetId;
        this.state.editMode = false;
        window.StateManager.setState('activeSheetId', sheetId);
        this.render();
    },

    // Создание нового листа
    async createSheet() {
        const name = prompt('Название листа:');
        if (!name) return;

        const income = prompt('Сумма дохода:');
        if (!income || isNaN(income)) return;

        try {
            const data = {
                name,
                income_amount: parseFloat(income),
                date: new Date().toISOString().split('T')[0]
            };

            const sheet = await window.APIClient.incomeSheets.create(data);
            this.state.sheets.push(sheet);
            this.state.expenses[sheet.id] = [];
            this.state.activeSheetId = sheet.id;
            
            this.render();
            this.showNotification('Лист доходов создан', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    },

    // Удаление листа
    async deleteSheet(sheetId) {
        if (!confirm('Удалить этот лист доходов?')) return;

        try {
            await window.APIClient.incomeSheets.delete(sheetId);
            this.state.sheets = this.state.sheets.filter(s => s.id !== sheetId);
            delete this.state.expenses[sheetId];
            
            if (this.state.activeSheetId === sheetId && this.state.sheets.length > 0) {
                this.state.activeSheetId = this.state.sheets[0].id;
            }
            
            this.render();
            this.showNotification('Лист доходов удален', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    },

    // Включение режима редактирования
    enableEditMode() {
        this.state.editMode = true;
        this.render();
    },

    // Отмена редактирования
    cancelEdit() {
        this.state.editMode = false;
        this.render();
    },

    // Сохранение листа
    async saveSheet(e) {
        e.preventDefault();
        const form = e.target;
        const sheet = this.state.sheets.find(s => s.id === this.state.activeSheetId);

        try {
            const data = {
                name: form.name.value,
                income_amount: parseFloat(form.income_amount.value),
                date: form.date.value
            };

            const updated = await window.APIClient.incomeSheets.update(sheet.id, data);
            
            // Обновляем локальное состояние
            const index = this.state.sheets.findIndex(s => s.id === sheet.id);
            this.state.sheets[index] = updated;
            
            this.state.editMode = false;
            this.render();
            this.showNotification('Лист доходов обновлен', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    },

    // Добавление расхода
    async addExpense(e) {
        e.preventDefault();
        const form = e.target;

        try {
            const data = {
                income_sheet_id: this.state.activeSheetId,
                amount: parseFloat(form.amount.value),
                note: form.note.value
            };

            const expense = await window.APIClient.expenses.create(data);
            
            if (!this.state.expenses[this.state.activeSheetId]) {
                this.state.expenses[this.state.activeSheetId] = [];
            }
            
            this.state.expenses[this.state.activeSheetId].push(expense);
            
            form.reset();
            this.render();
            this.showNotification('Расход добавлен', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    },

    // Удаление расхода
    async deleteExpense(expenseId) {
        if (!confirm('Удалить этот расход?')) return;

        try {
            await window.APIClient.expenses.delete(expenseId);
            
            // Удаляем из локального состояния
            this.state.expenses[this.state.activeSheetId] = 
                this.state.expenses[this.state.activeSheetId].filter(e => e.id !== expenseId);
            
            this.render();
            this.showNotification('Расход удален', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    },

    // Форматирование денег
    formatMoney(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(amount);
    },

    // Показ уведомления
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    },

    // Обработчики событий
    attachEventHandlers() {
        // Дополнительные обработчики при необходимости
    },

    // Маршруты модуля
    routes: {
        '/': function() {
            this.render();
        },
        '/coco-money': function() {
            this.render();
        }
    },

    // События модуля
    events: {
        'auth:login': function() {
            this.loadSheets();
        },
        'auth:logout': function() {
            this.state = {
                sheets: [],
                activeSheetId: null,
                editMode: false,
                expenses: {}
            };
        }
    }
};

// Регистрируем модуль
window.ModuleManager.register(CocoMoneyModule);

// Делаем модуль доступным глобально для onclick обработчиков
window.CocoMoneyModule = CocoMoneyModule;
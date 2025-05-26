// Главный модуль управления навигацией
const App = {
    currentModule: null,
    modules: {},
    
    init() {
        this.bindEvents();
        this.registerModules();
    },
    
    bindEvents() {
        // Клики по карточкам инструментов
        document.querySelectorAll('.tool-card[data-tool]').forEach(card => {
            card.addEventListener('click', () => {
                const tool = card.dataset.tool;
                if (card.querySelector('.status-available')) {
                    this.openModule(tool);
                }
            });
        });
        
        // Кнопки "Назад"
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.goHome());
        });
        
        // Закрытие модальных окон
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', e => {
                if (e.target === modal) Modal.close();
            });
        });
    },
    
    registerModules() {
        this.modules['coco-many'] = CocoManyModule;
        this.modules['scale-calc'] = ScaleCalcModule;
    },
    
    openModule(name) {
        if (this.modules[name]) {
            document.getElementById('main-page').style.display = 'none';
            document.getElementById(name).style.display = 'block';
            this.currentModule = name;
            this.modules[name].init();
        }
    },
    
    goHome() {
        document.getElementById('main-page').style.display = 'block';
        document.querySelectorAll('.app-module').forEach(m => m.style.display = 'none');
        this.currentModule = null;
    }
};

// Модуль модальных окон
const Modal = {
    current: null,
    confirmAction: null,
    
    show(id) {
        this.current = document.getElementById(id);
        this.current.style.display = 'block';
    },
    
    close() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        this.current = null;
        this.confirmAction = null;
    },
    
    confirm(message, action) {
        document.getElementById('confirm-message').textContent = message;
        this.confirmAction = action;
        this.show('confirm-modal');
    }
};

// Модуль Coco Many
const CocoManyModule = {
    sheets: [],
    currentSheet: null,
    
    init() {
        this.bindEvents();
        this.setDefaultDate();
        this.render();
    },
    
    bindEvents() {
        const addBtn = document.getElementById('add-sheet-btn');
        if (addBtn && !addBtn.hasAttribute('data-bound')) {
            addBtn.addEventListener('click', () => this.addSheet());
            addBtn.setAttribute('data-bound', 'true');
        }
        
        // Модальные окна
        document.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => Modal.close());
        });
        
        document.querySelector('#confirm-modal .danger-btn')?.addEventListener('click', () => {
            if (Modal.confirmAction) Modal.confirmAction();
            Modal.close();
        });
    },
    
    setDefaultDate() {
        const dateInput = document.getElementById('income-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    },
    
    addSheet() {
        const name = document.getElementById('sheet-name').value.trim() || 'Основной доход';
        const amount = parseFloat(document.getElementById('income-amount').value) || 0;
        const date = document.getElementById('income-date').value;
        
        if (!date) {
            alert('Выберите дату');
            return;
        }
        
        this.sheets.push({
            id: Date.now(),
            name, amount, date,
            expenses: []
        });
        
        this.clearForm();
        this.render();
    },
    
    clearForm() {
        document.getElementById('sheet-name').value = '';
        document.getElementById('income-amount').value = '';
        this.setDefaultDate();
    },
    
    render() {
        const container = document.getElementById('sheets-container');
        
        if (this.sheets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Нет листов доходов</h3>
                    <p>Создайте первый лист</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.sheets.map(sheet => {
            const total = sheet.expenses.reduce((sum, e) => sum + e.amount, 0);
            const balance = sheet.amount - total;
            
            return `
                <div class="sheet-card" onclick="CocoManyModule.openSheet(${sheet.id})">
                    <div class="sheet-header">
                        <div class="sheet-info">
                            <h3>${sheet.name}</h3>
                            <p>Дата: ${new Date(sheet.date).toLocaleDateString('ru-RU')}</p>
                            <p>Доход: ${sheet.amount.toLocaleString('ru-RU')} ₽</p>
                        </div>
                        <div class="balance">
                            <div class="balance-amount ${balance < 0 ? 'negative' : ''}">
                                ${balance.toLocaleString('ru-RU')} ₽
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    openSheet(id) {
        this.currentSheet = this.sheets.find(s => s.id === id);
        if (!this.currentSheet) return;
        
        document.getElementById('coco-many').style.display = 'none';
        document.getElementById('sheet-detail').style.display = 'block';
        this.renderSheetDetail();
    },
    
    renderSheetDetail() {
        const sheet = this.currentSheet;
        const total = sheet.expenses.reduce((sum, e) => sum + e.amount, 0);
        const balance = sheet.amount - total;
        
        document.getElementById('sheet-detail-content').innerHTML = `
            <div class="sheet-detail-header">
                <h2>${sheet.name}</h2>
                <div class="sheet-stats">
                    <div class="stat-item">
                        <span class="stat-value">${sheet.amount.toLocaleString('ru-RU')} ₽</span>
                        <span class="stat-label">Доход</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${total.toLocaleString('ru-RU')} ₽</span>
                        <span class="stat-label">Расходы</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value ${balance < 0 ? 'negative' : ''}">${balance.toLocaleString('ru-RU')} ₽</span>
                        <span class="stat-label">Баланс</span>
                    </div>
                </div>
            </div>
            
            <div class="actions">
                <button class="btn" onclick="CocoManyModule.editSheet()">Редактировать</button>
                <button class="btn danger-btn" onclick="CocoManyModule.deleteSheet()">Удалить</button>
            </div>
            
            <div class="expense-form">
                <h3>Добавить расход</h3>
                <div class="form-row">
                    <input type="number" id="expense-amount" placeholder="Сумма">
                    <input type="text" id="expense-note" placeholder="Описание">
                    <button class="btn" onclick="CocoManyModule.addExpense()">Добавить</button>
                </div>
            </div>
            
            <div class="expenses-list">
                <h3>Расходы</h3>
                ${sheet.expenses.length === 0 ? 
                    '<div class="empty-state"><p>Расходов нет</p></div>' :
                    sheet.expenses.map(e => `
                        <div class="expense-item">
                            <div class="expense-info">
                                <div class="expense-amount">-${e.amount.toLocaleString('ru-RU')} ₽</div>
                                <div class="expense-note">${e.note}</div>
                            </div>
                            <div class="expense-actions">
                                <button class="btn small" onclick="CocoManyModule.editExpense(${e.id})">Изменить</button>
                                <button class="btn danger-btn small" onclick="CocoManyModule.deleteExpense(${e.id})">Удалить</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        
        // Кнопка "К листам"
        document.querySelector('#sheet-detail .back-btn').onclick = () => this.backToSheets();
    },
    
    backToSheets() {
        document.getElementById('sheet-detail').style.display = 'none';
        document.getElementById('coco-many').style.display = 'block';
        this.render();
    },
    
    addExpense() {
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const note = document.getElementById('expense-note').value.trim();
        
        if (!amount || !note) {
            alert('Заполните все поля');
            return;
        }
        
        this.currentSheet.expenses.push({
            id: Date.now(),
            amount, note
        });
        
        document.getElementById('expense-amount').value = '';
        document.getElementById('expense-note').value = '';
        this.renderSheetDetail();
    },
    
    editSheet() {
        const sheet = this.currentSheet;
        document.getElementById('edit-sheet-name').value = sheet.name;
        document.getElementById('edit-income-amount').value = sheet.amount;
        document.getElementById('edit-income-date').value = sheet.date;
        
        Modal.show('edit-sheet-modal');
        
        // Привязываем сохранение
        document.querySelector('#edit-sheet-modal .success-btn').onclick = () => {
            sheet.name = document.getElementById('edit-sheet-name').value.trim() || 'Основной доход';
            sheet.amount = parseFloat(document.getElementById('edit-income-amount').value) || 0;
            sheet.date = document.getElementById('edit-income-date').value;
            Modal.close();
            this.renderSheetDetail();
        };
    },
    
    deleteSheet() {
        Modal.confirm(`Удалить лист "${this.currentSheet.name}"?`, () => {
            this.sheets = this.sheets.filter(s => s.id !== this.currentSheet.id);
            this.backToSheets();
        });
    },
    
    editExpense(expenseId) {
        const expense = this.currentSheet.expenses.find(e => e.id === expenseId);
        document.getElementById('edit-expense-amount').value = expense.amount;
        document.getElementById('edit-expense-note').value = expense.note;
        
        Modal.show('edit-expense-modal');
        
        document.querySelector('#edit-expense-modal .success-btn').onclick = () => {
            expense.amount = parseFloat(document.getElementById('edit-expense-amount').value) || 0;
            expense.note = document.getElementById('edit-expense-note').value.trim() || 'Без описания';
            Modal.close();
            this.renderSheetDetail();
        };
    },
    
    deleteExpense(expenseId) {
        const expense = this.currentSheet.expenses.find(e => e.id === expenseId);
        Modal.confirm(`Удалить расход "${expense.note}"?`, () => {
            this.currentSheet.expenses = this.currentSheet.expenses.filter(e => e.id !== expenseId);
            this.renderSheetDetail();
        });
    }
};

// Модуль калькулятора масштабов
const ScaleCalcModule = {
    history: [],
    
    init() {
        this.bindEvents();
    },
    
    bindEvents() {
        const scaleInput = document.getElementById('scale-input');
        const heightInput = document.getElementById('height-input');
        
        if (scaleInput) scaleInput.addEventListener('input', () => this.calcHeight());
        if (heightInput) heightInput.addEventListener('input', () => this.calcScale());
        
        // Пресеты
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const scale = btn.dataset.scale;
                document.getElementById('scale-input').value = scale;
                this.calcHeight();
                document.getElementById('height-input').value = '';
                this.clearResult('scale-result');
            });
        });
        
        // Очистка истории
        document.querySelector('.clear-btn')?.addEventListener('click', () => {
            this.history = [];
            this.updateHistory();
        });
    },
    
    calcHeight() {
        const scale = parseFloat(document.getElementById('scale-input').value);
        const result = document.getElementById('text-height-result');
        
        if (!scale || scale <= 0) {
            result.textContent = 'Введите масштаб';
            result.className = 'result empty';
            return;
        }
        
        const height = (scale / 1000) * 2.5;
        result.innerHTML = `<strong>${height.toFixed(2)} мм</strong><br>для 1:${scale.toLocaleString('ru-RU')}`;
        result.className = 'result';
        
        this.addHistory(`1:${scale.toLocaleString('ru-RU')} → ${height.toFixed(2)} мм`);
    },
    
    calcScale() {
        const height = parseFloat(document.getElementById('height-input').value);
        const result = document.getElementById('scale-result');
        
        if (!height || height <= 0) {
            result.textContent = 'Введите высоту';
            result.className = 'result empty';
            return;
        }
        
        const scale = Math.round((height / 2.5) * 1000);
        result.innerHTML = `<strong>1:${scale.toLocaleString('ru-RU')}</strong><br>для ${height} мм`;
        result.className = 'result';
        
        this.addHistory(`${height} мм → 1:${scale.toLocaleString('ru-RU')}`);
    },
    
    clearResult(id) {
        const el = document.getElementById(id);
        el.textContent = 'Введите высоту';
        el.className = 'result empty';
    },
    
    addHistory(calc) {
        if (this.history[0] === calc) return;
        
        this.history.unshift(calc);
        if (this.history.length > 10) this.history = this.history.slice(0, 10);
        
        this.updateHistory();
    },
    
    updateHistory() {
        const section = document.getElementById('history-section');
        const content = document.getElementById('history-content');
        
        if (this.history.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        content.innerHTML = this.history.map(item => `
            <div class="history-item">
                <span>${item}</span>
            </div>
        `).join('');
    }
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
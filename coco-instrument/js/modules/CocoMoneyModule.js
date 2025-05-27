/**
 * CocoMoneyModule - Модуль для управления доходами и расходами
 */
const CocoMoneyModule = {
    id: 'coco-money',
    name: 'Coco Money',
    version: '1.0.0',
    dependencies: [],

    // DOM элементы
    elements: {},
    
    // Состояние модуля
    state: {
        isEditMode: false,
        editingExpenseId: null
    },

    /**
     * Инициализация модуля
     */
    async init() {
        console.log('Initializing CocoMoneyModule...');
        
        this.bindElements();
        this.attachEventListeners();
        this.setupEventHandlers();
    },

    /**
     * Привязка DOM элементов
     */
    bindElements() {
        this.elements = {
            mainApp: document.getElementById('main-app'),
            cocoMoneyModule: document.getElementById('coco-money-module'),
            userEmail: document.getElementById('user-email'),
            logoutBtn: document.getElementById('logout-btn'),
            
            // Tabs
            incomeTabs: document.getElementById('income-tabs'),
            addSheetBtn: document.getElementById('add-sheet-btn'),
            
            // Sheet content
            sheetTitle: document.getElementById('sheet-title'),
            sheetBalance: document.getElementById('sheet-balance'),
            editSheetBtn: document.getElementById('edit-sheet-btn'),
            saveSheetBtn: document.getElementById('save-sheet-btn'),
            cancelEditBtn: document.getElementById('cancel-edit-btn'),
            
            // Sheet edit form
            sheetEditForm: document.getElementById('sheet-edit-form'),
            editSheetName: document.getElementById('edit-sheet-name'),
            editSheetIncome: document.getElementById('edit-sheet-income'),
            editSheetDate: document.getElementById('edit-sheet-date'),
            
            // Expenses
            expensesSection: document.getElementById('expenses-section'),
            addExpenseBtn: document.getElementById('add-expense-btn'),
            addExpenseForm: document.getElementById('add-expense-form'),
            expenseAmount: document.getElementById('expense-amount'),
            expenseNote: document.getElementById('expense-note'),
            saveExpenseBtn: document.getElementById('save-expense-btn'),
            cancelExpenseBtn: document.getElementById('cancel-expense-btn'),
            expensesList: document.getElementById('expenses-list'),
            
            // Modal
            addSheetModal: document.getElementById('add-sheet-modal'),
            addSheetForm: document.getElementById('add-sheet-form'),
            newSheetName: document.getElementById('new-sheet-name'),
            newSheetIncome: document.getElementById('new-sheet-income'),
            newSheetDate: document.getElementById('new-sheet-date'),
            closeModalBtn: document.getElementById('close-modal-btn'),
            cancelSheetBtn: document.getElementById('cancel-sheet-btn')
        };
    },

    /**
     * Подключение обработчиков событий
     */
    attachEventListeners() {
        // Header actions
        this.elements.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        
        // Tabs
        this.elements.addSheetBtn.addEventListener('click', this.showAddSheetModal.bind(this));
        
        // Sheet actions
        this.elements.editSheetBtn.addEventListener('click', this.enterEditMode.bind(this));
        this.elements.saveSheetBtn.addEventListener('click', this.saveSheet.bind(this));
        this.elements.cancelEditBtn.addEventListener('click', this.exitEditMode.bind(this));
        
        // Expenses
        this.elements.addExpenseBtn.addEventListener('click', this.showAddExpenseForm.bind(this));
        this.elements.saveExpenseBtn.addEventListener('click', this.saveExpense.bind(this));
        this.elements.cancelExpenseBtn.addEventListener('click', this.hideAddExpenseForm.bind(this));
        
        // Modal
        this.elements.addSheetForm.addEventListener('submit', this.createSheet.bind(this));
        this.elements.closeModalBtn.addEventListener('click', this.hideAddSheetModal.bind(this));
        this.elements.cancelSheetBtn.addEventListener('click', this.hideAddSheetModal.bind(this));
        
        // Close modal on outside click
        this.elements.addSheetModal.addEventListener('click', (e) => {
            if (e.target === this.elements.addSheetModal) {
                this.hideAddSheetModal();
            }
        });
    },

    /**
     * Настройка обработчиков событий приложения
     */
    setupEventHandlers() {
        // Подписываемся на изменения состояния
        window.StateManager.subscribe('currentSheet', this.onCurrentSheetChange.bind(this));
        window.StateManager.subscribe('incomeSheets', this.renderTabs.bind(this));
        window.StateManager.subscribe('expenses', this.renderExpenses.bind(this));
        window.StateManager.subscribe('user', this.updateUserInfo.bind(this));
    },

    /**
     * Обработчик выхода из системы
     */
    async handleLogout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            await window.APIClient.logout();
            this.hide();
            window.ModuleManager.activateModule('auth');
        }
    },

    /**
     * Показать модальное окно добавления листа
     */
    showAddSheetModal() {
        // Устанавливаем текущую дату по умолчанию
        const today = new Date().toISOString().split('T')[0];
        this.elements.newSheetDate.value = today;
        
        this.elements.addSheetModal.classList.remove('hidden');
        this.elements.newSheetName.focus();
    },

    /**
     * Скрыть модальное окно добавления листа
     */
    hideAddSheetModal() {
        this.elements.addSheetModal.classList.add('hidden');
        this.elements.addSheetForm.reset();
    },

    /**
     * Создать новый лист доходов
     */
    async createSheet(event) {
        event.preventDefault();
        
        const name = this.elements.newSheetName.value.trim();
        const income = parseFloat(this.elements.newSheetIncome.value) || 0;
        const date = this.elements.newSheetDate.value;
        
        if (!name) {
            alert('Пожалуйста, введите название листа');
            return;
        }

        try {
            const newSheet = {
                name,
                income,
                date
            };

            await window.APIClient.createIncomeSheet(newSheet);
            this.hideAddSheetModal();
            
        } catch (error) {
            console.error('Error creating sheet:', error);
            alert('Ошибка при создании листа');
        }
    },

    /**
     * Войти в режим редактирования листа
     */
    enterEditMode() {
        const currentSheet = window.StateManager.getState('currentSheet');
        if (!currentSheet) return;

        this.state.isEditMode = true;
        
        // Заполняем форму редактирования
        this.elements.editSheetName.value = currentSheet.name;
        this.elements.editSheetIncome.value = currentSheet.income;
        this.elements.editSheetDate.value = currentSheet.date;
        
        // Показываем форму и кнопки
        this.elements.sheetEditForm.classList.remove('hidden');
        this.elements.editSheetBtn.classList.add('hidden');
        this.elements.saveSheetBtn.classList.remove('hidden');
        this.elements.cancelEditBtn.classList.remove('hidden');
    },

    /**
     * Выйти из режима редактирования
     */
    exitEditMode() {
        this.state.isEditMode = false;
        
        this.elements.sheetEditForm.classList.add('hidden');
        this.elements.editSheetBtn.classList.remove('hidden');
        this.elements.saveSheetBtn.classList.add('hidden');
        this.elements.cancelEditBtn.classList.add('hidden');
    },

    /**
     * Сохранить изменения листа
     */
    async saveSheet() {
        const currentSheet = window.StateManager.getState('currentSheet');
        if (!currentSheet) return;

        const name = this.elements.editSheetName.value.trim();
        const income = parseFloat(this.elements.editSheetIncome.value) || 0;
        const date = this.elements.editSheetDate.value;
        
        if (!name) {
            alert('Пожалуйста, введите название листа');
            return;
        }

        try {
            const updates = { name, income, date };
            await window.APIClient.updateIncomeSheet(currentSheet.id, updates);
            this.exitEditMode();
        } catch (error) {
            console.error('Error updating sheet:', error);
            alert('Ошибка при сохранении листа');
        }
    },

    /**
     * Показать форму добавления расхода
     */
    showAddExpenseForm() {
        this.elements.addExpenseForm.classList.remove('hidden');
        this.elements.expenseAmount.focus();
    },

    /**
     * Скрыть форму добавления расхода
     */
    hideAddExpenseForm() {
        this.elements.addExpenseForm.classList.add('hidden');
        this.elements.expenseAmount.value = '';
        this.elements.expenseNote.value = '';
        this.state.editingExpenseId = null;
    },

    /**
     * Сохранить расход
     */
    async saveExpense() {
        const currentSheet = window.StateManager.getState('currentSheet');
        if (!currentSheet) return;

        const amount = parseFloat(this.elements.expenseAmount.value);
        const note = this.elements.expenseNote.value.trim();
        
        if (!amount || amount <= 0) {
            alert('Пожалуйста, введите корректную сумму');
            return;
        }

        try {
            if (this.state.editingExpenseId) {
                // Редактирование существующего расхода
                const updates = { amount, note };
                await window.APIClient.updateExpense(this.state.editingExpenseId, updates);
            } else {
                // Создание нового расхода
                const newExpense = {
                    sheetId: currentSheet.id,
                    amount,
                    note
                };
                await window.APIClient.createExpense(newExpense);
            }
            
            this.hideAddExpenseForm();
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Ошибка при сохранении расхода');
        }
    },

    /**
     * Редактировать расход
     */
    editExpense(expenseId) {
        const currentSheet = window.StateManager.getState('currentSheet');
        if (!currentSheet) return;

        const expenses = window.StateManager.getSheetExpenses(currentSheet.id);
        const expense = expenses.find(e => e.id === expenseId);
        
        if (!expense) return;

        this.state.editingExpenseId = expenseId;
        this.elements.expenseAmount.value = expense.amount;
        this.elements.expenseNote.value = expense.note || '';
        
        this.showAddExpenseForm();
    },

    /**
     * Удалить расход
     */
    async deleteExpense(expenseId) {
        if (!confirm('Вы уверены, что хотите удалить этот расход?')) {
            return;
        }

        try {
            await window.APIClient.deleteExpense(expenseId);
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Ошибка при удалении расхода');
        }
    },

    /**
     * Переключить активный лист
     */
    switchSheet(sheetId) {
        const sheets = window.StateManager.getState('incomeSheets');
        const sheet = sheets.find(s => s.id === sheetId);
        
        if (sheet) {
            window.StateManager.setCurrentSheet(sheet);
        }
    },

    /**
     * Удалить лист доходов
     */
    async deleteSheet(sheetId) {
        if (!confirm('Вы уверены, что хотите удалить этот лист доходов? Все связанные расходы также будут удалены.')) {
            return;
        }

        try {
            await window.APIClient.deleteIncomeSheet(sheetId);
        } catch (error) {
            console.error('Error deleting sheet:', error);
            alert('Ошибка при удалении листа');
        }
    },

    /**
     * Обработчик изменения текущего листа
     */
    onCurrentSheetChange(currentSheet) {
        this.renderSheetContent();
        this.renderExpenses();
        this.updateActiveTab();
    },

    /**
     * Обновить информацию о пользователе
     */
    updateUserInfo(user) {
        if (user && this.elements.userEmail) {
            this.elements.userEmail.textContent = user.email;
        }
    },

    /**
     * Отрендерить вкладки листов доходов
     */
    renderTabs() {
        const sheets = window.StateManager.getState('incomeSheets');
        const currentSheet = window.StateManager.getState('currentSheet');
        
        this.elements.incomeTabs.innerHTML = '';
        
        sheets.forEach(sheet => {
            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.innerHTML = `
                ${sheet.name}
                <button class="close-tab" data-sheet-id="${sheet.id}">&times;</button>
            `;
            
            if (currentSheet && currentSheet.id === sheet.id) {
                tab.classList.add('active');
            }
            
            // Обработчик клика по вкладке
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('close-tab')) {
                    this.switchSheet(sheet.id);
                }
            });
            
            // Обработчик закрытия вкладки
            const closeBtn = tab.querySelector('.close-tab');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSheet(sheet.id);
            });
            
            this.elements.incomeTabs.appendChild(tab);
        });
        
        // Если нет текущего листа, но есть листы, выбираем первый
        if (!currentSheet && sheets.length > 0) {
            window.StateManager.setCurrentSheet(sheets[0]);
        }
    },

    /**
     * Обновить активную вкладку
     */
    updateActiveTab() {
        const tabs = this.elements.incomeTabs.querySelectorAll('.tab');
        const currentSheet = window.StateManager.getState('currentSheet');
        
        tabs.forEach(tab => {
            tab.classList.remove('active');
            const closeBtn = tab.querySelector('.close-tab');
            if (closeBtn && currentSheet && closeBtn.dataset.sheetId === currentSheet.id) {
                tab.classList.add('active');
            }
        });
    },

    /**
     * Отрендерить содержимое листа
     */
    renderSheetContent() {
        const currentSheet = window.StateManager.getState('currentSheet');
        
        if (!currentSheet) {
            this.elements.sheetTitle.textContent = 'Выберите лист доходов';
            this.elements.sheetBalance.textContent = '0 ₽';
            this.elements.editSheetBtn.classList.add('hidden');
            this.elements.expensesSection.classList.add('hidden');
            return;
        }
        
        // Обновляем заголовок и баланс
        this.elements.sheetTitle.textContent = currentSheet.name;
        const balance = window.StateManager.getSheetBalance(currentSheet.id);
        this.elements.sheetBalance.textContent = `${balance.toLocaleString('ru-RU')} ₽`;
        this.elements.sheetBalance.style.color = balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        
        // Показываем кнопки и секцию расходов
        this.elements.editSheetBtn.classList.remove('hidden');
        this.elements.expensesSection.classList.remove('hidden');
    },

    /**
     * Отрендерить список расходов
     */
    renderExpenses() {
        const currentSheet = window.StateManager.getState('currentSheet');
        
        if (!currentSheet) {
            this.elements.expensesList.innerHTML = '';
            return;
        }
        
        const expenses = window.StateManager.getSheetExpenses(currentSheet.id);
        
        if (expenses.length === 0) {
            this.elements.expensesList.innerHTML = `
                <div class="empty-state">
                    <h3>Расходов пока нет</h3>
                    <p>Добавьте первый расход, нажав кнопку выше</p>
                </div>
            `;
            return;
        }
        
        const expensesHTML = expenses
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(expense => {
                const date = new Date(expense.date).toLocaleDateString('ru-RU');
                return `
                    <div class="expense-item">
                        <div class="expense-info">
                            <div class="expense-amount">-${parseFloat(expense.amount).toLocaleString('ru-RU')} ₽</div>
                            ${expense.note ? `<div class="expense-note">${expense.note}</div>` : ''}
                            <div class="expense-date">${date}</div>
                        </div>
                        <div class="expense-actions">
                            <button class="edit-expense-btn" onclick="window.ModuleManager.getModule('coco-money').editExpense('${expense.id}')">
                                Изменить
                            </button>
                            <button class="delete-expense-btn" onclick="window.ModuleManager.getModule('coco-money').deleteExpense('${expense.id}')">
                                Удалить
                            </button>
                        </div>
                    </div>
                `;
            })
            .join('');
        
        this.elements.expensesList.innerHTML = expensesHTML;
    },

    /**
     * Загрузить данные пользователя
     */
    async loadUserData() {
        try {
            // Загружаем листы доходов
            const sheetsResponse = await window.APIClient.getIncomeSheets();
            if (sheetsResponse.sheets) {
                window.StateManager.setState('incomeSheets', sheetsResponse.sheets);
                
                // Загружаем расходы для каждого листа
                const expensesData = {};
                for (const sheet of sheetsResponse.sheets) {
                    try {
                        const expensesResponse = await window.APIClient.getExpenses(sheet.id);
                        expensesData[sheet.id] = expensesResponse.expenses || [];
                    } catch (error) {
                        console.warn(`Failed to load expenses for sheet ${sheet.id}:`, error);
                        expensesData[sheet.id] = [];
                    }
                }
                window.StateManager.setState('expenses', expensesData);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    },

    /**
     * Показать модуль
     */
    async show() {
        const user = window.StateManager.getState('user');
        const isAuthenticated = window.StateManager.getState('isAuthenticated');
        
        if (!user || !isAuthenticated) {
            // Пользователь не аутентифицирован, переходим к авторизации
            window.ModuleManager.activateModule('auth');
            return;
        }
        
        this.elements.mainApp.classList.remove('hidden');
        this.elements.cocoMoneyModule.classList.add('active');
        
        // Обновляем информацию о пользователе
        this.updateUserInfo(user);
        
        // Загружаем данные пользователя
        await this.loadUserData();
        
        // Рендерим интерфейс
        this.renderTabs();
        this.renderSheetContent();
        this.renderExpenses();
    },

    /**
     * Скрыть модуль
     */
    hide() {
        this.elements.mainApp.classList.add('hidden');
        this.elements.cocoMoneyModule.classList.remove('active');
        
        // Выходим из режима редактирования, если активен
        if (this.state.isEditMode) {
            this.exitEditMode();
        }
        
        // Скрываем формы
        this.hideAddExpenseForm();
        this.hideAddSheetModal();
    },

    /**
     * Уничтожить модуль
     */
    destroy() {
        // Отписываемся от событий
        if (this.elements.logoutBtn) {
            this.elements.logoutBtn.removeEventListener('click', this.handleLogout);
        }
        if (this.elements.addSheetBtn) {
            this.elements.addSheetBtn.removeEventListener('click', this.showAddSheetModal);
        }
        
        // Очищаем состояние
        this.state = {
            isEditMode: false,
            editingExpenseId: null
        };
    }
};

// Регистрируем модуль после загрузки ModuleManager
if (typeof window !== 'undefined') {
    if (window.ModuleManager) {
        window.ModuleManager.register(CocoMoneyModule);
    } else {
        // Ждем загрузки ModuleManager
        document.addEventListener('DOMContentLoaded', () => {
            if (window.ModuleManager) {
                window.ModuleManager.register(CocoMoneyModule);
            } else {
                console.error('ModuleManager not found when registering CocoMoneyModule');
            }
        });
    }
}

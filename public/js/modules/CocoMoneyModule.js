// CocoMoneyModule.js - Модуль управления финансами
const CocoMoneyModule = {
    id: 'coco-money',
    name: 'Coco Money',
    version: '1.4.0',
    
    // Инициализация модуля
    init() {
        // Проверяем, что модуль еще не инициализирован
        if (this.initialized) return;
        
        this.currentSheetId = null;
        this.editingExpenseId = null;
        this.originalSheetData = null;
        this.swipeStartX = null;
        this.activeExpenseTab = 'regular';
        
        this.setupEventListeners();
        this.setupFormHandlers();
        this.subscribeToState();
        this.setupSwipeGestures();
        this.initialized = true;
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
        const nav = document.getElementById('main-nav');
        nav.classList.remove('hidden');
        
        const user = window.stateManager.getState('user');
        if (user) {
            document.getElementById('user-email').textContent = user.email;
        }
        
        document.getElementById('auth-module').classList.add('hidden');
        document.getElementById('home-module').classList.add('hidden');
        document.getElementById('coco-money-module').classList.remove('hidden');
        
        document.getElementById('sheet-fullscreen').classList.add('hidden');
        
        const sheets = window.stateManager.getState('incomeSheets');
        if (sheets.length === 0) {
            this.showEmptyState();
        } else {
            this.hideEmptyState();
            this.renderSheets();
            this.updateStatistics();
        }
        
        this.updateBalance();
    },
    
    // Показать пустое состояние
    showEmptyState() {
        document.getElementById('empty-state').classList.remove('hidden');
        document.getElementById('sheets-grid').classList.add('hidden');
        document.getElementById('statistics-section').classList.add('hidden');
        document.getElementById('fab-add-sheet').classList.add('hidden');
    },
    
    // Скрыть пустое состояние
    hideEmptyState() {
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('sheets-grid').classList.remove('hidden');
        document.getElementById('statistics-section').classList.remove('hidden');
        document.getElementById('fab-add-sheet').classList.remove('hidden');
    },
    
    // Подписка на изменения состояния
    subscribeToState() {
        // Подписываемся на изменения листов доходов
        window.stateManager.subscribe('incomeSheets', () => {
            const sheets = window.stateManager.getState('incomeSheets');
            if (sheets.length === 0) {
                this.showEmptyState();
                this.closeFullscreenSheet();
            } else {
                this.hideEmptyState();
                this.renderSheets();
                this.updateStatistics();
            }
            this.updateBalance();
        });
        
        // Подписываемся на изменения расходов
        window.stateManager.subscribe('expenses', () => {
            if (this.currentSheetId) {
                this.updateSheetInfo();
                this.renderExpenses();
            }
            this.updateBalance();
            this.updateStatistics();
            this.renderSheets();
        });
    },
    
    // Настройка обработчиков событий
    setupEventListeners() {
        // Плавающая кнопка добавления листа
        document.getElementById('fab-add-sheet').addEventListener('click', () => {
            this.showNewSheetModal();
        });
        
        // Кнопка создания первого листа
        document.getElementById('create-first-sheet').addEventListener('click', () => {
            this.showNewSheetModal();
        });
        
        // Кнопка назад
        document.getElementById('btn-back').addEventListener('click', () => {
            this.closeFullscreenSheet();
        });
        
        // Кнопка редактирования листа
        document.getElementById('edit-sheet-btn').addEventListener('click', () => {
            this.showEditForm();
        });
        
        // Кнопка экспорта
        document.getElementById('export-sheet-btn').addEventListener('click', () => {
            this.showExportModal();
        });
        
        // Кнопки сохранения/отмены редактирования листа
        document.getElementById('save-sheet-btn').addEventListener('click', () => {
            this.saveSheet();
        });
        
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.hideEditForm();
        });
        
        document.getElementById('delete-sheet-btn').addEventListener('click', () => {
            this.showConfirm('Удалить лист?', 'Все расходы этого листа также будут удалены. Это действие нельзя отменить.', () => {
                this.deleteSheet();
            }, 'danger');
        });
        
        // Вкладки расходов
        document.getElementById('tab-regular').addEventListener('click', () => {
            this.showExpenseTab('regular');
        });
        
        document.getElementById('tab-preliminary').addEventListener('click', () => {
            this.showExpenseTab('preliminary');
        });
        
        // Закрытие модального окна нового листа
        document.getElementById('cancel-new-sheet').addEventListener('click', () => {
            this.hideNewSheetModal();
        });
        
        // Модальное окно подтверждения
        document.getElementById('confirm-no').addEventListener('click', () => {
            this.hideConfirm();
        });
        
        // Модальное окно экспорта
        document.getElementById('copy-export').addEventListener('click', () => {
            this.copyExportData();
        });
        
        document.getElementById('download-export').addEventListener('click', () => {
            this.downloadExportData();
        });
        
        document.getElementById('close-export').addEventListener('click', () => {
            this.hideExportModal();
        });
        
        // Редактирование расхода
        document.getElementById('cancel-expense-edit').addEventListener('click', () => {
            this.hideExpenseEditModal();
        });
    },
    
    // Настройка обработчиков форм
    setupFormHandlers() {
        // Форма создания нового листа
        const newSheetForm = document.getElementById('new-sheet-form');
        newSheetForm.removeEventListener('submit', this.handleNewSheetSubmit);
        newSheetForm.addEventListener('submit', this.handleNewSheetSubmit = async (e) => {
            e.preventDefault();
            await this.createSheet(e.target);
        });
        
        // Форма добавления обычного расхода
        const addExpenseForm = document.getElementById('add-expense-form');
        addExpenseForm.removeEventListener('submit', this.handleAddExpenseSubmit);
        addExpenseForm.addEventListener('submit', this.handleAddExpenseSubmit = async (e) => {
            e.preventDefault();
            await this.addExpense(e.target, false);
        });
        
        // Форма добавления предварительного расхода
        const addPreliminaryForm = document.getElementById('add-preliminary-form');
        addPreliminaryForm.removeEventListener('submit', this.handleAddPreliminarySubmit);
        addPreliminaryForm.addEventListener('submit', this.handleAddPreliminarySubmit = async (e) => {
            e.preventDefault();
            await this.addExpense(e.target, true);
        });
        
        // Форма редактирования расхода
        const editExpenseForm = document.getElementById('expense-edit-form');
        editExpenseForm.removeEventListener('submit', this.handleEditExpenseSubmit);
        editExpenseForm.addEventListener('submit', this.handleEditExpenseSubmit = async (e) => {
            e.preventDefault();
            await this.updateExpense(e.target);
        });
    },
    
    // Показать вкладку расходов
    showExpenseTab(tab) {
        this.activeExpenseTab = tab;
        
        // Обновляем активную вкладку
        document.querySelectorAll('.expense-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        
        // Показываем соответствующий контент
        if (tab === 'regular') {
            document.getElementById('regular-expenses').classList.remove('hidden');
            document.getElementById('preliminary-expenses').classList.add('hidden');
        } else {
            document.getElementById('regular-expenses').classList.add('hidden');
            document.getElementById('preliminary-expenses').classList.remove('hidden');
        }
    },
    
    // Настройка жестов свайпа
    setupSwipeGestures() {
        const fullscreen = document.getElementById('sheet-fullscreen');
        
        // Touch события для мобильных устройств
        fullscreen.addEventListener('touchstart', (e) => {
            this.swipeStartX = e.touches[0].clientX;
        });
        
        fullscreen.addEventListener('touchmove', (e) => {
            if (!this.swipeStartX) return;
            
            const currentX = e.touches[0].clientX;
            const diffX = currentX - this.swipeStartX;
            
            // Свайп вправо для закрытия (показываем визуальный эффект только после 50px)
            if (diffX > 50) {
                const translateX = Math.min(diffX - 50, 300); // Ограничиваем максимальный сдвиг
                fullscreen.style.transform = `translateX(${translateX}px)`;
                fullscreen.style.opacity = 1 - (translateX / 300) * 0.3; // Плавное затухание
            }
        });
        
        fullscreen.addEventListener('touchend', (e) => {
            if (!this.swipeStartX) return;
            
            const endX = e.changedTouches[0].clientX;
            const diffX = endX - this.swipeStartX;
            
            if (diffX > 150) {
                // Закрываем если свайп больше 150px (увеличено с 100px)
                fullscreen.classList.add('swipe-close');
                setTimeout(() => {
                    this.closeFullscreenSheet();
                    fullscreen.classList.remove('swipe-close');
                    fullscreen.style.opacity = '';
                }, 300);
            } else {
                // Возвращаем на место с анимацией
                fullscreen.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                fullscreen.style.transform = '';
                fullscreen.style.opacity = '';
                setTimeout(() => {
                    fullscreen.style.transition = '';
                }, 300);
            }
            
            this.swipeStartX = null;
        });
    },
    
    // Загрузка данных с сервера
    async loadData() {
        this.showLoader(true);
        
        try {
            // Загружаем листы доходов
            const sheets = await window.apiClient.incomeSheets.getAll();
            window.stateManager.setState('incomeSheets', sheets);
            
            // Загружаем расходы для всех листов
            if (sheets.length > 0) {
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
    
    // Рендеринг карточек листов
    renderSheets() {
        const regularContainer = document.getElementById('regular-sheets');
        const preliminaryContainer = document.getElementById('preliminary-sheets');
        const sheets = window.stateManager.getState('incomeSheets');
        const expenses = window.stateManager.getState('expenses');
        
        const regularSheets = sheets.filter(s => !s.is_preliminary).sort((a, b) => new Date(b.date) - new Date(a.date));
        const preliminarySheets = sheets.filter(s => s.is_preliminary).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        regularContainer.innerHTML = '';
        if (regularSheets.length === 0) {
            regularContainer.innerHTML = '<div class="empty-sheets">Нет листов доходов</div>';
        } else {
            regularSheets.forEach(sheet => {
                regularContainer.appendChild(this.createSheetCard(sheet, expenses));
            });
        }
        
        preliminaryContainer.innerHTML = '';
        if (preliminarySheets.length === 0) {
            preliminaryContainer.innerHTML = '<div class="empty-sheets">Нет предварительных доходов</div>';
        } else {
            preliminarySheets.forEach(sheet => {
                preliminaryContainer.appendChild(this.createSheetCard(sheet, expenses));
            });
        }
    },
    
    createSheetCard(sheet, expenses) {
        const sheetExpenses = expenses.filter(e => e.income_sheet_id === sheet.id && !e.is_preliminary);
        const totalExpenses = sheetExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const balance = parseFloat(sheet.income_amount) - totalExpenses;
        
        const card = document.createElement('div');
        card.className = `sheet-card ${sheet.exclude_from_balance ? 'excluded' : ''} ${sheet.is_preliminary ? 'preliminary' : ''}`;
        card.innerHTML = `
            <div class="sheet-card-header">
                <h3 class="sheet-card-title">${sheet.name}</h3>
                <span class="sheet-card-date">${this.formatDate(sheet.date)}</span>
            </div>
            <div class="sheet-card-stats">
                <div class="sheet-stat">
                    <div class="sheet-stat-label">Доход</div>
                    <div class="sheet-stat-value income">${this.formatMoney(sheet.income_amount)} руб.</div>
                </div>
                <div class="sheet-stat">
                    <div class="sheet-stat-label">Расходы</div>
                    <div class="sheet-stat-value expense">${this.formatMoney(totalExpenses)} руб.</div>
                </div>
                <div class="sheet-stat">
                    <div class="sheet-stat-label">Баланс</div>
                    <div class="sheet-stat-value">${this.formatMoney(balance)} руб.</div>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.openFullscreenSheet(sheet.id);
        });
        
        return card;
    },
    
    // Открыть лист на весь экран
    openFullscreenSheet(sheetId) {
        this.currentSheetId = sheetId;
        const sheet = window.stateManager.getState('incomeSheets').find(s => s.id === sheetId);
        
        if (!sheet) return;
        
        // Обновляем заголовок
        document.getElementById('fullscreen-sheet-title').textContent = sheet.name;
        
        // Показываем полноэкранный вид
        document.getElementById('sheet-fullscreen').classList.remove('hidden');
        document.getElementById('sheet-fullscreen').style.transform = '';
        
        // Обновляем информацию
        this.updateSheetInfo();
        this.renderExpenses();
        
        // Скрываем форму редактирования
        this.hideEditForm();
        
        // Показываем вкладку обычных расходов по умолчанию
        this.showExpenseTab('regular');
    },
    
    // Закрыть полноэкранный вид
    closeFullscreenSheet() {
        document.getElementById('sheet-fullscreen').classList.add('hidden');
        this.currentSheetId = null;
        this.hideEditForm();
    },
    
    // Обновление информации о листе
    updateSheetInfo() {
        if (!this.currentSheetId) return;
        
        const sheet = window.stateManager.getState('incomeSheets').find(s => s.id === this.currentSheetId);
        if (!sheet) return;
        
        const expenses = window.stateManager.getState('expenses').filter(e => e.income_sheet_id === this.currentSheetId && !e.is_preliminary);
        const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const balance = parseFloat(sheet.income_amount) - totalExpenses;
        
        document.getElementById('sheet-income').textContent = `${this.formatMoney(sheet.income_amount)} руб.`;
        document.getElementById('sheet-expenses').textContent = `${this.formatMoney(totalExpenses)} руб.`;
        document.getElementById('sheet-balance').textContent = `${this.formatMoney(balance)} руб.`;
    },
    
    // Рендеринг расходов
    renderExpenses() {
        if (!this.currentSheetId) return;
        
        const regularContainer = document.getElementById('expenses-list');
        const preliminaryContainer = document.getElementById('preliminary-list');
        const expenses = window.stateManager.getState('expenses').filter(e => e.income_sheet_id === this.currentSheetId);
        
        const regularExpenses = expenses.filter(e => !e.is_preliminary);
        const preliminaryExpenses = expenses.filter(e => e.is_preliminary);
        
        // Рендерим обычные расходы
        regularContainer.innerHTML = '';
        if (regularExpenses.length === 0) {
            regularContainer.innerHTML = '<div class="empty-state"><p>Нет расходов</p></div>';
        } else {
            regularExpenses.forEach(expense => {
                regularContainer.appendChild(this.createExpenseItem(expense));
            });
        }
        
        // Рендерим предварительные расходы
        preliminaryContainer.innerHTML = '';
        if (preliminaryExpenses.length === 0) {
            preliminaryContainer.innerHTML = '<div class="empty-state"><p>Нет предварительных расходов</p></div>';
        } else {
            preliminaryExpenses.forEach(expense => {
                preliminaryContainer.appendChild(this.createExpenseItem(expense));
            });
        }
    },
    
    // Создание элемента расхода
    createExpenseItem(expense) {
        const item = document.createElement('div');
        item.className = `expense-item ${expense.is_preliminary ? 'preliminary' : ''}`;
        item.innerHTML = `
            <div class="expense-info">
                <div class="expense-amount">${this.formatMoney(expense.amount)} руб.</div>
                ${expense.note ? `<div class="expense-note">${expense.note}</div>` : ''}
                <div class="expense-date">${this.formatDate(expense.created_at)}</div>
            </div>
            <div class="expense-actions">
                <button class="btn-icon edit" data-expense-id="${expense.id}" title="Редактировать">
                    ✏️
                </button>
                <button class="btn-icon delete" data-expense-id="${expense.id}" title="Удалить">
                    🗑️
                </button>
            </div>
        `;
        
        // Обработчик редактирования
        item.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showExpenseEditModal(expense);
        });
        
        // Обработчик удаления
        item.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showConfirm('Удалить расход?', 'Вы уверены, что хотите удалить этот расход?', () => {
                this.deleteExpense(expense.id);
            }, 'danger');
        });
        
        return item;
    },
    
    // Обновление общего баланса
    updateBalance() {
        const totalBalance = window.stateManager.calculateTotalBalance();
        document.getElementById('total-balance').textContent = `${this.formatMoney(totalBalance)} руб.`;
    },
    
    // Обновление статистики
    updateStatistics() {
        const sheets = window.stateManager.getState('incomeSheets');
        const expenses = window.stateManager.getState('expenses');
        
        // Фильтруем листы, исключенные из баланса
        const includedSheets = sheets.filter(s => !s.exclude_from_balance);
        const includedSheetIds = includedSheets.map(s => s.id);
        
        // Общее количество листов (включенных)
        document.getElementById('stat-total-sheets').textContent = includedSheets.length;
        
        // Общий доход (только включенные листы)
        const totalIncome = includedSheets.reduce((sum, sheet) => sum + parseFloat(sheet.income_amount), 0);
        document.getElementById('stat-total-income').textContent = `${this.formatMoney(totalIncome)} руб.`;
        
        // Общие расходы (только обычные расходы включенных листов)
        const includedExpenses = expenses.filter(e => includedSheetIds.includes(e.income_sheet_id) && !e.is_preliminary);
        const totalExpenses = includedExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        document.getElementById('stat-total-expenses').textContent = `${this.formatMoney(totalExpenses)} руб.`;
        
        // Средний расход
        const avgExpense = includedExpenses.length > 0 ? totalExpenses / includedExpenses.length : 0;
        document.getElementById('stat-avg-expense').textContent = `${this.formatMoney(avgExpense)} руб.`;
        
        // Предварительные расходы (все листы)
        const preliminaryExpenses = expenses.filter(e => e.is_preliminary);
        const totalPreliminary = preliminaryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        document.getElementById('stat-preliminary').textContent = `${this.formatMoney(totalPreliminary)} руб.`;
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
        const isPreliminary = form.elements['new-sheet-preliminary'].checked;
        
        this.showLoader(true);
        
        try {
            const sheet = await window.apiClient.incomeSheets.create({
                name,
                income_amount: parseFloat(income),
                date,
                exclude_from_balance: false,
                is_preliminary: isPreliminary
            });
            
            const sheets = window.stateManager.getState('incomeSheets');
            sheets.push(sheet);
            window.stateManager.setState('incomeSheets', sheets);
            
            this.hideNewSheetModal();
            this.showToast('Лист доходов создан', 'success');
        } catch (error) {
            this.showToast('Ошибка создания листа', 'error');
        } finally {
            this.showLoader(false);
        }
    }, form.elements['new-sheet-date'].value;
        
        this.showLoader(true);
        
        try {
            const sheet = await window.apiClient.incomeSheets.create({
                name,
                income_amount: parseFloat(income),
                date,
                exclude_from_balance: false
            });
            
            // Добавляем в состояние
            const sheets = window.stateManager.getState('incomeSheets');
            sheets.push(sheet);
            window.stateManager.setState('incomeSheets', sheets);
            
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
        if (!this.currentSheetId) return;
        
        const sheet = window.stateManager.getState('incomeSheets').find(s => s.id === this.currentSheetId);
        if (!sheet) return;
        
        // Сохраняем оригинальные данные
        this.originalSheetData = {
            name: sheet.name,
            income_amount: sheet.income_amount,
            date: sheet.date,
            exclude_from_balance: sheet.exclude_from_balance
        };
        
        document.getElementById('sheet-info').classList.add('hidden');
        document.getElementById('sheet-edit-form').classList.remove('hidden');
        
        // Заполняем форму текущими данными
        document.getElementById('edit-sheet-name').value = sheet.name;
        document.getElementById('edit-sheet-income').value = sheet.income_amount;
        // Форматируем дату для input[type="date"]
        const date = new Date(sheet.date);
        const formattedDate = date.toISOString().split('T')[0];
        document.getElementById('edit-sheet-date').value = formattedDate;
        document.getElementById('edit-sheet-exclude').checked = sheet.exclude_from_balance || false;
    },
    
    // Скрыть форму редактирования
    hideEditForm() {
        document.getElementById('sheet-info').classList.remove('hidden');
        document.getElementById('sheet-edit-form').classList.add('hidden');
        this.originalSheetData = null;
    },
    
    // Сохранение изменений листа
    async saveSheet() {
        if (!this.currentSheetId) return;
        
        const name = document.getElementById('edit-sheet-name').value;
        const income = document.getElementById('edit-sheet-income').value;
        const date = document.getElementById('edit-sheet-date').value;
        const excludeFromBalance = document.getElementById('edit-sheet-exclude').checked;
        
        // Проверяем, были ли изменения
        if (this.originalSheetData &&
            this.originalSheetData.name === name &&
            parseFloat(this.originalSheetData.income_amount) === parseFloat(income) &&
            this.originalSheetData.date === date &&
            this.originalSheetData.exclude_from_balance === excludeFromBalance) {
            // Ничего не изменилось, просто закрываем форму
            this.hideEditForm();
            return;
        }
        
        this.showConfirm('Сохранить изменения?', 'Вы уверены, что хотите сохранить изменения?', async () => {
            this.showLoader(true);
            
            try {
                const updated = await window.apiClient.incomeSheets.update(this.currentSheetId, {
                    name,
                    income_amount: parseFloat(income),
                    date,
                    exclude_from_balance: excludeFromBalance
                });
                
                // Обновляем в состоянии
                const sheets = window.stateManager.getState('incomeSheets');
                const index = sheets.findIndex(s => s.id === this.currentSheetId);
                sheets[index] = updated;
                window.stateManager.setState('incomeSheets', sheets);
                
                // Обновляем заголовок
                document.getElementById('fullscreen-sheet-title').textContent = name;
                
                this.hideEditForm();
                this.showToast('Изменения сохранены', 'success');
            } catch (error) {
                this.showToast('Ошибка сохранения', 'error');
            } finally {
                this.showLoader(false);
            }
        });
    },
    
    // Удаление листа
    async deleteSheet() {
        if (!this.currentSheetId) return;
        
        this.showLoader(true);
        
        try {
            await window.apiClient.incomeSheets.delete(this.currentSheetId);
            
            // Удаляем из состояния
            const sheets = window.stateManager.getState('incomeSheets').filter(s => s.id !== this.currentSheetId);
            const expenses = window.stateManager.getState('expenses').filter(e => e.income_sheet_id !== this.currentSheetId);
            
            window.stateManager.setState('incomeSheets', sheets);
            window.stateManager.setState('expenses', expenses);
            
            this.closeFullscreenSheet();
            this.showToast('Лист удален', 'success');
        } catch (error) {
            this.showToast('Ошибка удаления', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Добавление расхода
    async addExpense(form, isPreliminary) {
        if (!this.currentSheetId) return;
        
        const amountField = isPreliminary ? 'preliminary-amount' : 'expense-amount';
        const noteField = isPreliminary ? 'preliminary-note' : 'expense-note';
        
        const amount = form.elements[amountField].value;
        const note = form.elements[noteField].value;
        
        this.showLoader(true);
        
        try {
            const expense = await window.apiClient.expenses.create({
                income_sheet_id: this.currentSheetId,
                amount: parseFloat(amount),
                note,
                is_preliminary: isPreliminary
            });
            
            // Добавляем в состояние
            const expenses = window.stateManager.getState('expenses');
            expenses.push(expense);
            window.stateManager.setState('expenses', expenses);
            
            form.reset();
            this.showToast(`${isPreliminary ? 'Предварительный расход' : 'Расход'} добавлен`, 'success');
        } catch (error) {
            this.showToast('Ошибка добавления расхода', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Показать модальное окно редактирования расхода
    showExpenseEditModal(expense) {
        this.editingExpenseId = expense.id;
        
        document.getElementById('edit-expense-id').value = expense.id;
        document.getElementById('edit-expense-amount').value = expense.amount;
        document.getElementById('edit-expense-note').value = expense.note || '';
        document.getElementById('edit-expense-preliminary').checked = expense.is_preliminary || false;
        
        document.getElementById('expense-edit-modal').classList.remove('hidden');
        document.getElementById('edit-expense-amount').focus();
    },
    
    // Скрыть модальное окно редактирования расхода
    hideExpenseEditModal() {
        document.getElementById('expense-edit-modal').classList.add('hidden');
        document.getElementById('expense-edit-form').reset();
        this.editingExpenseId = null;
    },
    
    // Обновление расхода
    async updateExpense(form) {
        const expenseId = form.elements['edit-expense-id'].value;
        const amount = form.elements['edit-expense-amount'].value;
        const note = form.elements['edit-expense-note'].value;
        const isPreliminary = form.elements['edit-expense-preliminary'].checked;
        
        this.showLoader(true);
        
        try {
            const updated = await window.apiClient.expenses.update(expenseId, {
                amount: parseFloat(amount),
                note,
                is_preliminary: isPreliminary
            });
            
            // Обновляем в состоянии
            const expenses = window.stateManager.getState('expenses');
            const index = expenses.findIndex(e => e.id === parseInt(expenseId));
            if (index !== -1) {
                expenses[index] = { ...expenses[index], ...updated };
                window.stateManager.setState('expenses', expenses);
            }
            
            this.hideExpenseEditModal();
            this.showToast('Расход обновлен', 'success');
        } catch (error) {
            this.showToast('Ошибка обновления расхода', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    // Удаление расхода
    async deleteExpense(expenseId) {
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
    
    // Показать модальное окно подтверждения
    showConfirm(title, message, onConfirm, type = 'default') {
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const yesBtn = document.getElementById('confirm-yes');
        yesBtn.className = type === 'danger' ? 'btn-danger' : 'btn-primary';
        
        // Удаляем старый обработчик и добавляем новый
        const newYesBtn = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
        
        newYesBtn.addEventListener('click', () => {
            this.hideConfirm();
            onConfirm();
        });
    },
    
    // Скрыть модальное окно подтверждения
    hideConfirm() {
        document.getElementById('confirm-modal').classList.add('hidden');
    },
    
    // Показать модальное окно экспорта
    showExportModal() {
        if (!this.currentSheetId) return;
        
        const sheet = window.stateManager.getState('incomeSheets').find(s => s.id === this.currentSheetId);
        if (!sheet) return;
        
        const expenses = window.stateManager.getState('expenses').filter(e => e.income_sheet_id === this.currentSheetId);
        const regularExpenses = expenses.filter(e => !e.is_preliminary);
        const preliminaryExpenses = expenses.filter(e => e.is_preliminary);
        
        const totalRegular = regularExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const totalPreliminary = preliminaryExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        const balance = parseFloat(sheet.income_amount) - totalRegular;
        
        // Формируем текст для экспорта
        let exportText = `ЛИСТ ДОХОДОВ: ${sheet.name}\n`;
        exportText += `Дата: ${this.formatDate(sheet.date)}\n`;
        if (sheet.exclude_from_balance) {
            exportText += `Статус: Исключен из общего баланса\n`;
        }
        exportText += `=====================================\n\n`;
        exportText += `Доход: ${this.formatMoney(sheet.income_amount)} руб.\n`;
        exportText += `Расходы: ${this.formatMoney(totalRegular)} руб.\n`;
        exportText += `Остаток: ${this.formatMoney(balance)} руб.\n\n`;
        
        if (regularExpenses.length > 0) {
            exportText += `СПИСОК РАСХОДОВ:\n`;
            exportText += `=====================================\n`;
            regularExpenses.forEach((expense, index) => {
                exportText += `${index + 1}. ${this.formatMoney(expense.amount)} руб.`;
                if (expense.note) {
                    exportText += ` - ${expense.note}`;
                }
                exportText += ` (${this.formatDate(expense.created_at)})\n`;
            });
        }
        
        if (preliminaryExpenses.length > 0) {
            exportText += `\nПРЕДВАРИТЕЛЬНЫЕ РАСХОДЫ:\n`;
            exportText += `=====================================\n`;
            exportText += `Итого: ${this.formatMoney(totalPreliminary)} руб.\n\n`;
            preliminaryExpenses.forEach((expense, index) => {
                exportText += `${index + 1}. ${this.formatMoney(expense.amount)} руб.`;
                if (expense.note) {
                    exportText += ` - ${expense.note}`;
                }
                exportText += ` (${this.formatDate(expense.created_at)})\n`;
            });
        }
        
        this.exportData = exportText;
        document.getElementById('export-preview').textContent = exportText;
        document.getElementById('export-modal').classList.remove('hidden');
    },
    
    // Скрыть модальное окно экспорта
    hideExportModal() {
        document.getElementById('export-modal').classList.add('hidden');
    },
    
    // Копировать данные экспорта
    copyExportData() {
        navigator.clipboard.writeText(this.exportData).then(() => {
            this.showToast('Скопировано в буфер обмена', 'success');
        }).catch(() => {
            this.showToast('Ошибка копирования', 'error');
        });
    },
    
    // Скачать данные экспорта
    downloadExportData() {
        if (!this.currentSheetId) return;
        
        const sheet = window.stateManager.getState('incomeSheets').find(s => s.id === this.currentSheetId);
        if (!sheet) return;
        
        const blob = new Blob([this.exportData], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sheet.name.replace(/[^a-zа-я0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Файл скачан', 'success');
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

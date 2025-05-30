const CocoMoneyModule = {
    id: 'coco-money',
    name: 'Coco Money',
    version: '1.4.0',
    
    init() {
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
    
    async activate() {
        await this.loadData();
        this.render();
    },
    
    render() {
        const nav = document.getElementById('main-nav');
        if (nav) nav.classList.remove('hidden');
        
        const user = window.stateManager.getState('user');
        if (user) {
            const emailElement = document.getElementById('user-email');
            if (emailElement) emailElement.textContent = user.email;
        }
        
        ['auth-module', 'home-module'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        const cocoMoneyModule = document.getElementById('coco-money-module');
        if (cocoMoneyModule) cocoMoneyModule.classList.remove('hidden');
        
        const fullscreenSheet = document.getElementById('sheet-fullscreen');
        if (fullscreenSheet) fullscreenSheet.classList.add('hidden');
        
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
    
    showEmptyState() {
        const elements = {
            'empty-state': false,
            'sheets-grid': true,
            'statistics-section': true,
            'fab-add-sheet': true
        };
        
        Object.entries(elements).forEach(([id, hide]) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', hide);
        });
    },
    
    hideEmptyState() {
        const elements = {
            'empty-state': true,
            'sheets-grid': false,
            'statistics-section': false,
            'fab-add-sheet': false
        };
        
        Object.entries(elements).forEach(([id, hide]) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', hide);
        });
    },
    
    subscribeToState() {
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
    
    setupEventListeners() {
        const listeners = {
            'fab-add-sheet': () => this.showNewSheetModal(),
            'create-first-sheet': () => this.showNewSheetModal(),
            'btn-back': () => this.closeFullscreenSheet(),
            'edit-sheet-btn': () => this.showEditForm(),
            'export-sheet-btn': () => this.showExportModal(),
            'save-sheet-btn': () => this.saveSheet(),
            'cancel-edit-btn': () => this.hideEditForm(),
            'delete-sheet-btn': () => this.showConfirm('Удалить лист?', 'Все расходы этого листа также будут удалены. Это действие нельзя отменить.', () => this.deleteSheet(), 'danger'),
            'tab-regular': () => this.showExpenseTab('regular'),
            'tab-preliminary': () => this.showExpenseTab('preliminary'),
            'cancel-new-sheet': () => this.hideNewSheetModal(),
            'confirm-no': () => this.hideConfirm(),
            'copy-export': () => this.copyExportData(),
            'download-export': () => this.downloadExportData(),
            'close-export': () => this.hideExportModal(),
            'cancel-expense-edit': () => this.hideExpenseEditModal()
        };
        
        Object.entries(listeners).forEach(([id, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        });
    },
    
    setupFormHandlers() {
        const forms = {
            'new-sheet-form': (e) => this.createSheet(e.target),
            'add-expense-form': (e) => this.addExpense(e.target, false),
            'add-preliminary-form': (e) => this.addExpense(e.target, true),
            'expense-edit-form': (e) => this.updateExpense(e.target)
        };
        
        Object.entries(forms).forEach(([id, handler]) => {
            const form = document.getElementById(id);
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await handler(e);
                });
            }
        });
    },
    
    showExpenseTab(tab) {
        this.activeExpenseTab = tab;
        
        document.querySelectorAll('.expense-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        
        const tabsVisibility = {
            'regular-expenses': tab === 'regular',
            'preliminary-expenses': tab !== 'regular'
        };
        
        Object.entries(tabsVisibility).forEach(([id, show]) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', !show);
        });
    },
    
    setupSwipeGestures() {
        const fullscreen = document.getElementById('sheet-fullscreen');
        
        fullscreen.addEventListener('touchstart', (e) => {
            this.swipeStartX = e.touches[0].clientX;
        });
        
        fullscreen.addEventListener('touchmove', (e) => {
            if (!this.swipeStartX) return;
            
            const currentX = e.touches[0].clientX;
            const diffX = currentX - this.swipeStartX;
            
            if (diffX > 50) {
                const translateX = Math.min(diffX - 50, 300);
                fullscreen.style.transform = `translateX(${translateX}px)`;
                fullscreen.style.opacity = 1 - (translateX / 300) * 0.3;
            }
        });
        
        fullscreen.addEventListener('touchend', (e) => {
            if (!this.swipeStartX) return;
            
            const endX = e.changedTouches[0].clientX;
            const diffX = endX - this.swipeStartX;
            
            if (diffX > 150) {
                fullscreen.classList.add('swipe-close');
                setTimeout(() => {
                    this.closeFullscreenSheet();
                    fullscreen.classList.remove('swipe-close');
                    fullscreen.style.opacity = '';
                }, 300);
            } else {
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
    
    async loadData() {
        this.showLoader(true);
        
        try {
            const sheets = await window.apiClient.incomeSheets.getAll();
            window.stateManager.setState('incomeSheets', sheets);
            
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
    
    renderSheets() {
        const container = document.getElementById('sheets-grid');
        const sheets = window.stateManager.getState('incomeSheets');
        const expenses = window.stateManager.getState('expenses');
        
        container.innerHTML = '';
        
        sheets.forEach(sheet => {
            const sheetExpenses = expenses.filter(e => e.income_sheet_id === sheet.id && !e.is_preliminary);
            const totalExpenses = sheetExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
            const balance = parseFloat(sheet.income_amount) - totalExpenses;
            
            const card = document.createElement('div');
            card.className = `sheet-card ${sheet.exclude_from_balance ? 'excluded' : ''}`;
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
            
            card.addEventListener('click', () => this.openFullscreenSheet(sheet.id));
            container.appendChild(card);
        });
    },
    
    openFullscreenSheet(sheetId) {
        this.currentSheetId = sheetId;
        const sheet = window.stateManager.getState('incomeSheets').find(s => s.id === sheetId);
        
        if (!sheet) return;
        
        document.getElementById('fullscreen-sheet-title').textContent = sheet.name;
        document.getElementById('sheet-fullscreen').classList.remove('hidden');
        document.getElementById('sheet-fullscreen').style.transform = '';
        
        this.updateSheetInfo();
        this.renderExpenses();
        this.hideEditForm();
        this.showExpenseTab('regular');
    },
    
    closeFullscreenSheet() {
        document.getElementById('sheet-fullscreen').classList.add('hidden');
        this.currentSheetId = null;
        this.hideEditForm();
    },
    
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
    
    renderExpenses() {
        if (!this.currentSheetId) return;
        
        const containers = {
            'expenses-list': false,
            'preliminary-list': true
        };
        
        const expenses = window.stateManager.getState('expenses').filter(e => e.income_sheet_id === this.currentSheetId);
        
        Object.entries(containers).forEach(([id, isPreliminary]) => {
            const container = document.getElementById(id);
            const filtered = expenses.filter(e => e.is_preliminary === isPreliminary);
            
            container.innerHTML = '';
            if (filtered.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>Нет расходов</p></div>';
            } else {
                filtered.forEach(expense => {
                    container.appendChild(this.createExpenseItem(expense));
                });
            }
        });
    },
    
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
                <button class="btn-icon edit" data-expense-id="${expense.id}" title="Редактировать">✏️</button>
                <button class="btn-icon delete" data-expense-id="${expense.id}" title="Удалить">🗑️</button>
            </div>
        `;
        
        item.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showExpenseEditModal(expense);
        });
        
        item.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showConfirm('Удалить расход?', 'Вы уверены, что хотите удалить этот расход?', () => {
                this.deleteExpense(expense.id);
            }, 'danger');
        });
        
        return item;
    },
    
    updateBalance() {
        const totalBalance = window.stateManager.calculateTotalBalance();
        document.getElementById('total-balance').textContent = `${this.formatMoney(totalBalance)} руб.`;
    },
    
    updateStatistics() {
        const sheets = window.stateManager.getState('incomeSheets');
        const expenses = window.stateManager.getState('expenses');
        
        const includedSheets = sheets.filter(s => !s.exclude_from_balance);
        const includedSheetIds = includedSheets.map(s => s.id);
        
        const totalIncome = includedSheets.reduce((sum, sheet) => sum + parseFloat(sheet.income_amount), 0);
        const includedExpenses = expenses.filter(e => includedSheetIds.includes(e.income_sheet_id) && !e.is_preliminary);
        const totalExpenses = includedExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        const avgExpense = includedExpenses.length > 0 ? totalExpenses / includedExpenses.length : 0;
        
        const preliminaryExpenses = expenses.filter(e => e.is_preliminary);
        const totalPreliminary = preliminaryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        const stats = {
            'stat-total-sheets': includedSheets.length,
            'stat-total-income': `${this.formatMoney(totalIncome)} руб.`,
            'stat-total-expenses': `${this.formatMoney(totalExpenses)} руб.`,
            'stat-avg-expense': `${this.formatMoney(avgExpense)} руб.`,
            'stat-preliminary': `${this.formatMoney(totalPreliminary)} руб.`
        };
        
        Object.entries(stats).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    },
    
    showNewSheetModal() {
        document.getElementById('new-sheet-modal').classList.remove('hidden');
        document.getElementById('new-sheet-name').focus();
        document.getElementById('new-sheet-date').value = new Date().toISOString().split('T')[0];
    },
    
    hideNewSheetModal() {
        document.getElementById('new-sheet-modal').classList.add('hidden');
        document.getElementById('new-sheet-form').reset();
    },
    
    async createSheet(form) {
        const formData = new FormData(form);
        const data = {
            name: formData.get('new-sheet-name'),
            income_amount: parseFloat(formData.get('new-sheet-income')),
            date: formData.get('new-sheet-date'),
            exclude_from_balance: false
        };
        
        this.showLoader(true);
        
        try {
            const sheet = await window.apiClient.incomeSheets.create(data);
            
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
    
    showEditForm() {
        if (!this.currentSheetId) return;
        
        const sheet = window.stateManager.getState('incomeSheets').find(s => s.id === this.currentSheetId);
        if (!sheet) return;
        
        this.originalSheetData = { ...sheet };
        
        document.getElementById('sheet-info').classList.add('hidden');
        document.getElementById('sheet-edit-form').classList.remove('hidden');
        
        document.getElementById('edit-sheet-name').value = sheet.name;
        document.getElementById('edit-sheet-income').value = sheet.income_amount;
        document.getElementById('edit-sheet-date').value = new Date(sheet.date).toISOString().split('T')[0];
        document.getElementById('edit-sheet-exclude').checked = sheet.exclude_from_balance || false;
    },
    
    hideEditForm() {
        document.getElementById('sheet-info').classList.remove('hidden');
        document.getElementById('sheet-edit-form').classList.add('hidden');
        this.originalSheetData = null;
    },
    
    async saveSheet() {
        if (!this.currentSheetId) return;
        
        const data = {
            name: document.getElementById('edit-sheet-name').value,
            income_amount: parseFloat(document.getElementById('edit-sheet-income').value),
            date: document.getElementById('edit-sheet-date').value,
            exclude_from_balance: document.getElementById('edit-sheet-exclude').checked
        };
        
        const hasChanges = Object.keys(data).some(key => {
            return this.originalSheetData[key] !== data[key];
        });
        
        if (!hasChanges) {
            this.hideEditForm();
            return;
        }
        
        this.showConfirm('Сохранить изменения?', 'Вы уверены, что хотите сохранить изменения?', async () => {
            this.showLoader(true);
            
            try {
                const updated = await window.apiClient.incomeSheets.update(this.currentSheetId, data);
                
                const sheets = window.stateManager.getState('incomeSheets');
                const index = sheets.findIndex(s => s.id === this.currentSheetId);
                sheets[index] = updated;
                window.stateManager.setState('incomeSheets', sheets);
                
                document.getElementById('fullscreen-sheet-title').textContent = data.name;
                
                this.hideEditForm();
                this.showToast('Изменения сохранены', 'success');
            } catch (error) {
                this.showToast('Ошибка сохранения', 'error');
            } finally {
                this.showLoader(false);
            }
        });
    },
    
    async deleteSheet() {
        if (!this.currentSheetId) return;
        
        this.showLoader(true);
        
        try {
            await window.apiClient.incomeSheets.delete(this.currentSheetId);
            
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
    
    async addExpense(form, isPreliminary) {
        if (!this.currentSheetId) return;
        
        const formData = new FormData(form);
        const prefix = isPreliminary ? 'preliminary' : 'expense';
        
        const data = {
            income_sheet_id: this.currentSheetId,
            amount: parseFloat(formData.get(`${prefix}-amount`)),
            note: formData.get(`${prefix}-note`),
            is_preliminary: isPreliminary
        };
        
        this.showLoader(true);
        
        try {
            const expense = await window.apiClient.expenses.create(data);
            
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
    
    showExpenseEditModal(expense) {
        this.editingExpenseId = expense.id;
        
        document.getElementById('edit-expense-id').value = expense.id;
        document.getElementById('edit-expense-amount').value = expense.amount;
        document.getElementById('edit-expense-note').value = expense.note || '';
        document.getElementById('edit-expense-preliminary').checked = expense.is_preliminary || false;
        
        document.getElementById('expense-edit-modal').classList.remove('hidden');
        document.getElementById('edit-expense-amount').focus();
    },
    
    hideExpenseEditModal() {
        document.getElementById('expense-edit-modal').classList.add('hidden');
        document.getElementById('expense-edit-form').reset();
        this.editingExpenseId = null;
    },
    
    async updateExpense(form) {
        const formData = new FormData(form);
        const expenseId = formData.get('edit-expense-id');
        
        const data = {
            amount: parseFloat(formData.get('edit-expense-amount')),
            note: formData.get('edit-expense-note'),
            is_preliminary: formData.get('edit-expense-preliminary') === 'on'
        };
        
        this.showLoader(true);
        
        try {
            const updated = await window.apiClient.expenses.update(expenseId, data);
            
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
    
    async deleteExpense(expenseId) {
        this.showLoader(true);
        
        try {
            await window.apiClient.expenses.delete(expenseId);
            
            const expenses = window.stateManager.getState('expenses').filter(e => e.id !== expenseId);
            window.stateManager.setState('expenses', expenses);
            
            this.showToast('Расход удален', 'success');
        } catch (error) {
            this.showToast('Ошибка удаления расхода', 'error');
        } finally {
            this.showLoader(false);
        }
    },
    
    showConfirm(title, message, onConfirm, type = 'default') {
        document.getElementById('confirm-modal').classList.remove('hidden');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const yesBtn = document.getElementById('confirm-yes');
        yesBtn.className = type === 'danger' ? 'btn-danger' : 'btn-primary';
        
        const newYesBtn = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
        
        newYesBtn.addEventListener('click', () => {
            this.hideConfirm();
            onConfirm();
        });
    },
    
    hideConfirm() {
        document.getElementById('confirm-modal').classList.add('hidden');
    },
    
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
    
    hideExportModal() {
        document.getElementById('export-modal').classList.add('hidden');
    },
    
    copyExportData() {
        navigator.clipboard.writeText(this.exportData).then(() => {
            this.showToast('Скопировано в буфер обмена', 'success');
        }).catch(() => {
            this.showToast('Ошибка копирования', 'error');
        });
    },
    
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
    
    formatMoney(amount) {
        return new Intl.NumberFormat('ru-RU').format(amount);
    },
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ru-RU');
    },
    
    showLoader(show) {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.toggle('hidden', !show);
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

window.moduleManager.register(CocoMoneyModule);

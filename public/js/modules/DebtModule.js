(function() {
    'use strict';
    
    const DebtModule = {
        id: 'debts',
        name: 'Долги',
        version: '1.0.0',
        
        init() {
            if (this.initialized) return;
            
            this.currentDebtId = null;
            this.editingDebtId = null;
            this.activeFilter = 'all';
            this.sortBy = 'dueDate';
            
            this.initialized = true;
        },
        
        async activate() {
            console.log('Activating DebtModule');
            await this.loadData();
            this.render();
            this.setupEventListeners();
            this.setupFormHandlers();
        },
        
        render() {
            const nav = document.getElementById('main-nav');
            if (nav) nav.classList.remove('hidden');
            
            const user = window.stateManager.getState('user');
            if (user) {
                document.getElementById('user-email').textContent = user.email;
            }
            
            ['auth-module', 'home-module', 'coco-money-module'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            
            const debtsModule = document.getElementById('debts-module');
            if (debtsModule) debtsModule.classList.remove('hidden');
            
            const debtDetails = document.getElementById('debt-details');
            if (debtDetails) debtDetails.classList.add('hidden');
            
            const debts = window.stateManager.getState('debts') || [];
            if (debts.length === 0) {
                this.showEmptyState();
            } else {
                this.hideEmptyState();
                this.renderDebts();
                this.updateStatistics();
            }
        },
        
        showEmptyState() {
            const elements = {
                'empty-debts': false,
                'debts-container': true,
                'debt-statistics': true,
                'fab-add-debt': true
            };
            
            Object.entries(elements).forEach(([id, hide]) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', hide);
            });
        },
        
        hideEmptyState() {
            const elements = {
                'empty-debts': true,
                'debts-container': false,
                'debt-statistics': false,
                'fab-add-debt': false
            };
            
            Object.entries(elements).forEach(([id, hide]) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', hide);
            });
        },
        
        setupEventListeners() {
            const listeners = {
                'fab-add-debt': () => this.showNewDebtModal(),
                'create-first-debt': () => this.showNewDebtModal(),
                'btn-back-debt': () => this.closeDebtDetails(),
                'edit-debt-btn': () => this.showEditForm(),
                'export-debt-btn': () => this.exportToCSV(),
                'save-debt-btn': () => this.saveDebt(),
                'cancel-debt-edit': () => this.hideEditForm(),
                'delete-debt-btn': () => this.showConfirm('Удалить долг?', 'Вся история платежей будет удалена. Это действие нельзя отменить.', () => this.deleteDebt(), 'danger'),
                'cancel-new-debt': () => this.hideNewDebtModal(),
                'confirm-no': () => this.hideConfirm(),
                'filter-all': () => this.setFilter('all'),
                'filter-active': () => this.setFilter('active'),
                'filter-partial': () => this.setFilter('partial'),
                'filter-paid': () => this.setFilter('paid'),
                'filter-overdue': () => this.setFilter('overdue'),
                'sort-date': () => this.setSortBy('dueDate'),
                'sort-amount': () => this.setSortBy('amount'),
                'sort-priority': () => this.setSortBy('priority')
            };
            
            Object.entries(listeners).forEach(([id, handler]) => {
                const el = document.getElementById(id);
                if (el) {
                    el.removeEventListener('click', handler);
                    el.addEventListener('click', handler);
                }
            });
        },
        
        setupFormHandlers() {
            const forms = {
                'new-debt-form': (e) => this.createDebt(e.target),
                'add-payment-form': (e) => this.addPayment(e.target)
            };
            
            Object.entries(forms).forEach(([id, handler]) => {
                const form = document.getElementById(id);
                if (form) {
                    form.removeEventListener('submit', form._handler);
                    form._handler = async (e) => {
                        e.preventDefault();
                        await handler(e);
                    };
                    form.addEventListener('submit', form._handler);
                }
            });
        },
        
        async loadData() {
            this.showLoader(true);
            
            try {
                const debts = await window.apiClient.debts.getAll();
                window.stateManager.setState('debts', debts);
            } catch (error) {
                this.showToast('Ошибка загрузки данных', 'error');
                console.error('Load data error:', error);
            } finally {
                this.showLoader(false);
            }
        },
        
        renderDebts() {
            const container = document.getElementById('debts-list');
            const debts = this.getFilteredAndSortedDebts();
            
            container.innerHTML = '';
            
            if (debts.length === 0) {
                container.innerHTML = '<div class="empty-filtered">Нет долгов по выбранному фильтру</div>';
                return;
            }
            
            debts.forEach(debt => {
                const card = this.createDebtCard(debt);
                container.appendChild(card);
            });
        },
        
        createDebtCard(debt) {
            const daysUntilDue = this.getDaysUntilDue(debt.due_date);
            const colorClass = this.getColorClass(daysUntilDue, debt.status);
            const remainingAmount = debt.amount - this.getTotalPayments(debt);
            
            const card = document.createElement('div');
            card.className = `debt-card ${colorClass}`;
            card.innerHTML = `
                <div class="debt-indicator"></div>
                <div class="debt-card-content">
                    <div class="debt-card-header">
                        <div>
                            <h3 class="debt-card-title">${debt.creditor_name}</h3>
                            <span class="debt-card-type">${debt.creditor_type}</span>
                        </div>
                        <div class="debt-priority priority-${debt.priority}">
                            ${this.getPriorityIcon(debt.priority)}
                        </div>
                    </div>
                    <div class="debt-card-body">
                        <div class="debt-amount">
                            <span class="debt-remaining">${this.formatMoney(remainingAmount)} ${debt.currency}</span>
                            <span class="debt-total">из ${this.formatMoney(debt.amount)} ${debt.currency}</span>
                        </div>
                        <div class="debt-meta">
                            <span class="debt-category">${debt.category}</span>
                            <span class="debt-due-date">${this.formatDueDate(debt.due_date, daysUntilDue)}</span>
                        </div>
                    </div>
                    <div class="debt-status status-${debt.status}">${this.getStatusText(debt.status)}</div>
                </div>
            `;
            
            card.addEventListener('click', () => this.openDebtDetails(debt.id));
            return card;
        },
        
        getFilteredAndSortedDebts() {
            let debts = window.stateManager.getState('debts') || [];
            
            if (this.activeFilter !== 'all') {
                debts = debts.filter(debt => {
                    if (this.activeFilter === 'overdue') {
                        return debt.status === 'active' && new Date(debt.due_date) < new Date();
                    }
                    return debt.status === this.activeFilter;
                });
            }
            
            debts.sort((a, b) => {
                switch (this.sortBy) {
                    case 'dueDate':
                        return new Date(a.due_date) - new Date(b.due_date);
                    case 'amount':
                        return b.amount - a.amount;
                    case 'priority':
                        return a.priority - b.priority;
                    default:
                        return 0;
                }
            });
            
            return debts;
        },
        
        setFilter(filter) {
            this.activeFilter = filter;
            
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`filter-${filter}`).classList.add('active');
            
            this.renderDebts();
        },
        
        setSortBy(sortBy) {
            this.sortBy = sortBy;
            
            document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`sort-${sortBy.toLowerCase()}`).classList.add('active');
            
            this.renderDebts();
        },
        
        getDaysUntilDue(dueDate) {
            const due = new Date(dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            due.setHours(0, 0, 0, 0);
            
            const diffTime = due - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays;
        },
        
        getColorClass(daysUntilDue, status) {
            if (status === 'paid') return 'debt-paid';
            if (status === 'partial') return 'debt-partial';
            if (daysUntilDue < 0) return 'debt-overdue';
            if (daysUntilDue <= 7) return 'debt-warning';
            return 'debt-active';
        },
        
        getPriorityIcon(priority) {
            const icons = ['', '🔴', '🟡', '🟢'];
            return icons[priority] || '';
        },
        
        getStatusText(status) {
            const texts = {
                'active': 'Активный',
                'partial': 'Частично',
                'paid': 'Погашен',
                'overdue': 'Просрочен'
            };
            return texts[status] || status;
        },
        
        formatDueDate(dueDate, daysUntilDue) {
            if (daysUntilDue < 0) {
                return `Просрочен на ${Math.abs(daysUntilDue)} дн.`;
            } else if (daysUntilDue === 0) {
                return 'Сегодня';
            } else if (daysUntilDue === 1) {
                return 'Завтра';
            } else {
                return `Через ${daysUntilDue} дн.`;
            }
        },
        
        getTotalPayments(debt) {
            if (!debt.payments || debt.payments.length === 0) return 0;
            return debt.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        },
        
        openDebtDetails(debtId) {
            this.currentDebtId = debtId;
            const debt = window.stateManager.getState('debts').find(d => d.id === debtId);
            
            if (!debt) return;
            
            document.getElementById('debt-details-title').textContent = debt.creditor_name;
            document.getElementById('debt-details').classList.remove('hidden');
            
            this.updateDebtInfo();
            this.renderPayments();
            this.hideEditForm();
        },
        
        closeDebtDetails() {
            document.getElementById('debt-details').classList.add('hidden');
            this.currentDebtId = null;
            this.hideEditForm();
        },
        
        updateDebtInfo() {
            if (!this.currentDebtId) return;
            
            const debt = window.stateManager.getState('debts').find(d => d.id === this.currentDebtId);
            if (!debt) return;
            
            const totalPayments = this.getTotalPayments(debt);
            const remaining = debt.amount - totalPayments;
            const progress = (totalPayments / debt.amount) * 100;
            
            document.getElementById('debt-creditor').textContent = `${debt.creditor_name} (${debt.creditor_type})`;
            document.getElementById('debt-amount').textContent = `${this.formatMoney(debt.amount)} ${debt.currency}`;
            document.getElementById('debt-remaining').textContent = `${this.formatMoney(remaining)} ${debt.currency}`;
            document.getElementById('debt-progress').textContent = `${Math.round(progress)}%`;
            document.getElementById('debt-category').textContent = debt.category;
            document.getElementById('debt-due').textContent = this.formatDate(debt.due_date);
            document.getElementById('debt-description').textContent = debt.description || 'Нет описания';
            document.getElementById('debt-contact').textContent = debt.contact_info || 'Не указан';
            
            const progressBar = document.getElementById('debt-progress-bar');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
                progressBar.className = `progress-bar ${this.getColorClass(this.getDaysUntilDue(debt.due_date), debt.status)}`;
            }
        },
        
        renderPayments() {
            if (!this.currentDebtId) return;
            
            const container = document.getElementById('payments-list');
            const debt = window.stateManager.getState('debts').find(d => d.id === this.currentDebtId);
            
            if (!debt || !debt.payments || debt.payments.length === 0) {
                container.innerHTML = '<div class="empty-payments">Нет платежей</div>';
                return;
            }
            
            container.innerHTML = '';
            
            debt.payments.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            debt.payments.forEach(payment => {
                const item = document.createElement('div');
                item.className = 'payment-item';
                item.innerHTML = `
                    <div class="payment-info">
                        <div class="payment-amount">${this.formatMoney(payment.amount)} ${debt.currency}</div>
                        ${payment.comment ? `<div class="payment-comment">${payment.comment}</div>` : ''}
                        <div class="payment-date">${this.formatDate(payment.date)}</div>
                    </div>
                `;
                container.appendChild(item);
            });
        },
        
        showNewDebtModal() {
            document.getElementById('new-debt-modal').classList.remove('hidden');
            document.getElementById('new-debt-creditor').focus();
            
            document.getElementById('new-debt-date').value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        },
        
        hideNewDebtModal() {
            document.getElementById('new-debt-modal').classList.add('hidden');
            document.getElementById('new-debt-form').reset();
        },
        
        async createDebt(form) {
            const formData = new FormData(form);
            const data = {
                creditor_name: formData.get('new-debt-creditor'),
                creditor_type: formData.get('new-debt-type'),
                amount: parseFloat(formData.get('new-debt-amount')),
                currency: formData.get('new-debt-currency'),
                description: formData.get('new-debt-description'),
                due_date: formData.get('new-debt-date'),
                category: formData.get('new-debt-category'),
                priority: parseInt(formData.get('new-debt-priority')),
                contact_info: formData.get('new-debt-contact')
            };
            
            this.showLoader(true);
            
            try {
                const debt = await window.apiClient.debts.create(data);
                
                const debts = window.stateManager.getState('debts') || [];
                debts.push(debt);
                window.stateManager.setState('debts', debts);
                
                this.hideNewDebtModal();
                this.hideEmptyState();
                this.renderDebts();
                this.updateStatistics();
                this.showToast('Долг добавлен', 'success');
            } catch (error) {
                this.showToast('Ошибка создания долга', 'error');
            } finally {
                this.showLoader(false);
            }
        },
        
        showEditForm() {
            if (!this.currentDebtId) return;
            
            const debt = window.stateManager.getState('debts').find(d => d.id === this.currentDebtId);
            if (!debt) return;
            
            this.originalDebtData = { ...debt };
            
            document.getElementById('debt-info').classList.add('hidden');
            document.getElementById('debt-edit-form').classList.remove('hidden');
            
            document.getElementById('edit-debt-creditor').value = debt.creditor_name;
            document.getElementById('edit-debt-type').value = debt.creditor_type;
            document.getElementById('edit-debt-amount').value = debt.amount;
            document.getElementById('edit-debt-currency').value = debt.currency;
            document.getElementById('edit-debt-description').value = debt.description || '';
            document.getElementById('edit-debt-date').value = debt.due_date;
            document.getElementById('edit-debt-category').value = debt.category;
            document.getElementById('edit-debt-priority').value = debt.priority;
            document.getElementById('edit-debt-contact').value = debt.contact_info || '';
        },
        
        hideEditForm() {
            document.getElementById('debt-info').classList.remove('hidden');
            document.getElementById('debt-edit-form').classList.add('hidden');
            this.originalDebtData = null;
        },
        
        async saveDebt() {
            if (!this.currentDebtId) return;
            
            const data = {
                creditor_name: document.getElementById('edit-debt-creditor').value,
                creditor_type: document.getElementById('edit-debt-type').value,
                amount: parseFloat(document.getElementById('edit-debt-amount').value),
                currency: document.getElementById('edit-debt-currency').value,
                description: document.getElementById('edit-debt-description').value,
                due_date: document.getElementById('edit-debt-date').value,
                category: document.getElementById('edit-debt-category').value,
                priority: parseInt(document.getElementById('edit-debt-priority').value),
                contact_info: document.getElementById('edit-debt-contact').value
            };
            
            this.showConfirm('Сохранить изменения?', 'Вы уверены, что хотите сохранить изменения?', async () => {
                this.showLoader(true);
                
                try {
                    const updated = await window.apiClient.debts.update(this.currentDebtId, data);
                    
                    const debts = window.stateManager.getState('debts');
                    const index = debts.findIndex(d => d.id === this.currentDebtId);
                    debts[index] = { ...debts[index], ...updated };
                    window.stateManager.setState('debts', debts);
                    
                    document.getElementById('debt-details-title').textContent = data.creditor_name;
                    
                    this.updateDebtInfo();
                    this.hideEditForm();
                    this.renderDebts();
                    this.updateStatistics();
                    this.showToast('Изменения сохранены', 'success');
                } catch (error) {
                    this.showToast('Ошибка сохранения', 'error');
                } finally {
                    this.showLoader(false);
                }
            });
        },
        
        async deleteDebt() {
            if (!this.currentDebtId) return;
            
            this.showLoader(true);
            
            try {
                await window.apiClient.debts.delete(this.currentDebtId);
                
                const debts = window.stateManager.getState('debts').filter(d => d.id !== this.currentDebtId);
                window.stateManager.setState('debts', debts);
                
                this.closeDebtDetails();
                
                if (debts.length === 0) {
                    this.showEmptyState();
                } else {
                    this.renderDebts();
                    this.updateStatistics();
                }
                
                this.showToast('Долг удален', 'success');
            } catch (error) {
                this.showToast('Ошибка удаления', 'error');
            } finally {
                this.showLoader(false);
            }
        },
        
        async addPayment(form) {
            if (!this.currentDebtId) return;
            
            const formData = new FormData(form);
            const data = {
                amount: parseFloat(formData.get('payment-amount')),
                comment: formData.get('payment-comment'),
                date: new Date().toISOString().split('T')[0]
            };
            
            this.showLoader(true);
            
            try {
                const payment = await window.apiClient.debts.addPayment(this.currentDebtId, data);
                
                const debts = window.stateManager.getState('debts');
                const debt = debts.find(d => d.id === this.currentDebtId);
                
                if (!debt.payments) debt.payments = [];
                debt.payments.push(payment);
                
                const totalPayments = this.getTotalPayments(debt);
                if (totalPayments >= debt.amount) {
                    debt.status = 'paid';
                } else if (totalPayments > 0) {
                    debt.status = 'partial';
                }
                
                window.stateManager.setState('debts', debts);
                
                form.reset();
                this.updateDebtInfo();
                this.renderPayments();
                this.renderDebts();
                this.updateStatistics();
                this.showToast('Платеж добавлен', 'success');
            } catch (error) {
                this.showToast('Ошибка добавления платежа', 'error');
            } finally {
                this.showLoader(false);
            }
        },
        
        updateStatistics() {
            const debts = window.stateManager.getState('debts') || [];
            
            const totalDebts = debts.reduce((sum, debt) => sum + debt.amount, 0);
            const totalPaid = debts.reduce((sum, debt) => sum + this.getTotalPayments(debt), 0);
            const totalRemaining = totalDebts - totalPaid;
            
            const activeDebts = debts.filter(d => d.status === 'active' || d.status === 'partial').length;
            const overdueDebts = debts.filter(d => d.status === 'active' && new Date(d.due_date) < new Date()).length;
            
            document.getElementById('stat-total-debts').textContent = `${this.formatMoney(totalDebts)} руб.`;
            document.getElementById('stat-total-paid').textContent = `${this.formatMoney(totalPaid)} руб.`;
            document.getElementById('stat-remaining').textContent = `${this.formatMoney(totalRemaining)} руб.`;
            document.getElementById('stat-active-count').textContent = activeDebts;
            document.getElementById('stat-overdue-count').textContent = overdueDebts;
        },
        
        exportToCSV() {
            const debts = window.stateManager.getState('debts') || [];
            
            const headers = ['Кредитор', 'Тип', 'Сумма', 'Валюта', 'Описание', 'Срок', 'Статус', 'Категория', 'Приоритет', 'Контакт', 'Выплачено'];
            
            const rows = debts.map(debt => [
                debt.creditor_name,
                debt.creditor_type,
                debt.amount,
                debt.currency,
                debt.description || '',
                debt.due_date,
                this.getStatusText(debt.status),
                debt.category,
                debt.priority,
                debt.contact_info || '',
                this.getTotalPayments(debt)
            ]);
            
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');
            
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `debts_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showToast('Данные экспортированы', 'success');
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

    window.moduleManager.register(DebtModule);
})();

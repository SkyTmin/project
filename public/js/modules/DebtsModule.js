(function() {
    'use strict';
    
    const DebtsModule = {
        id: 'debts',
        name: 'Debts',
        version: '1.0.0',
        
        init() {
            if (this.initialized) return;
            
            this.currentDebtId = null;
            this.currentFilter = 'all';
            this.editingPaymentId = null;
            
            this.setupEventListeners();
            this.setupFormHandlers();
            this.subscribeToState();
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
            
            ['auth-module', 'home-module', 'finance-hub-module', 'coco-money-module'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            
            const debtsModule = document.getElementById('debts-module');
            if (debtsModule) debtsModule.classList.remove('hidden');
            
            const fullscreenDebt = document.getElementById('debt-fullscreen');
            if (fullscreenDebt) fullscreenDebt.classList.add('hidden');
            
            const debts = window.stateManager.getState('debts');
            if (debts.length === 0) {
                this.showEmptyState();
            } else {
                this.hideEmptyState();
                this.renderDebts();
                this.updateStatistics();
            }
            
            this.updateSummary();
        },
        
        showEmptyState() {
            const elements = {
                'debts-empty-state': false,
                'debts-list-container': true,
                'debts-statistics': true,
                'fab-add-debt': true
            };
            
            Object.entries(elements).forEach(([id, hide]) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', hide);
            });
        },
        
        hideEmptyState() {
            const elements = {
                'debts-empty-state': true,
                'debts-list-container': false,
                'debts-statistics': false,
                'fab-add-debt': false
            };
            
            Object.entries(elements).forEach(([id, hide]) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', hide);
            });
        },
        
        subscribeToState() {
            window.stateManager.subscribe('debts', () => {
                const debts = window.stateManager.getState('debts');
                if (debts.length === 0) {
                    this.showEmptyState();
                    this.closeFullscreenDebt();
                } else {
                    this.hideEmptyState();
                    this.renderDebts();
                    this.updateStatistics();
                }
                this.updateSummary();
            });
            
            window.stateManager.subscribe('debtPayments', () => {
                if (this.currentDebtId) {
                    this.updateDebtInfo();
                    this.renderPayments();
                }
                this.updateSummary();
                this.updateStatistics();
                this.renderDebts();
            });
        },
        
        setupEventListeners() {
            const listeners = {
                'fab-add-debt': () => this.showNewDebtModal(),
                'create-first-debt': () => this.showNewDebtModal(),
                'debt-btn-back': () => this.closeFullscreenDebt(),
                'edit-debt-btn': () => this.showEditForm(),
                'export-debt-btn': () => this.showExportModal(),
                'save-debt-btn': () => this.saveDebt(),
                'cancel-debt-edit-btn': () => this.hideEditForm(),
                'delete-debt-btn': () => this.showConfirm('Удалить долг?', 'Все платежи по этому долгу также будут удалены. Это действие нельзя отменить.', () => this.deleteDebt(), 'danger'),
                'cancel-new-debt': () => this.hideNewDebtModal(),
                'cancel-payment-edit': () => this.hidePaymentEditModal()
            };
            
            Object.entries(listeners).forEach(([id, handler]) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', handler);
            });
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.setFilter(e.target.getAttribute('data-filter'));
                });
            });
        },
        
        setupFormHandlers() {
            const forms = {
                'new-debt-form': (e) => this.createDebt(e.target),
                'add-payment-form': (e) => this.addPayment(e.target),
                'payment-edit-form': (e) => this.updatePayment(e.target)
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
        
        setFilter(filter) {
            this.currentFilter = filter;
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
            });
            
            this.renderDebts();
        },
        
        async loadData() {
            this.showLoader(true);
            
            try {
                const debts = await window.apiClient.debts.getAll();
                debts.sort((a, b) => {
                    if (a.status !== b.status) {
                        const statusOrder = { 'overdue': 0, 'active': 1, 'paid': 2 };
                        return statusOrder[a.status] - statusOrder[b.status];
                    }
                    return new Date(a.due_date) - new Date(b.due_date);
                });
                window.stateManager.setState('debts', debts);
                
                if (debts.length > 0) {
                    const allPayments = [];
                    for (const debt of debts) {
                        const payments = await window.apiClient.debtPayments.getByDebt(debt.id);
                        allPayments.push(...payments);
                    }
                    window.stateManager.setState('debtPayments', allPayments);
                }
            } catch (error) {
                this.showToast('Ошибка загрузки данных', 'error');
                console.error('Load data error:', error);
            } finally {
                this.showLoader(false);
            }
        },
        
        renderDebts() {
            const container = document.getElementById('debts-list');
            const debts = window.stateManager.getState('debts');
            const payments = window.stateManager.getState('debtPayments');
            
            container.innerHTML = '';
            
            const filteredDebts = debts.filter(debt => {
                if (this.currentFilter === 'all') return true;
                if (this.currentFilter === 'active') return debt.status === 'active';
                if (this.currentFilter === 'paid') return debt.status === 'paid';
                if (this.currentFilter === 'overdue') return debt.status === 'overdue';
                return true;
            });
            
            if (filteredDebts.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>Нет долгов в этой категории</p></div>';
                return;
            }
            
            filteredDebts.forEach(debt => {
                const debtPayments = payments.filter(p => p.debt_id === debt.id);
                const paidAmount = debtPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                const remainingAmount = parseFloat(debt.total_amount) - paidAmount;
                const progressPercent = (paidAmount / parseFloat(debt.total_amount)) * 100;
                
                const card = document.createElement('div');
                card.className = `debt-card status-${debt.status}`;
                card.innerHTML = `
                    <div class="debt-card-header">
                        <div>
                            <h3 class="debt-card-title">${debt.name}</h3>
                            <div class="debt-card-creditor">${debt.creditor}</div>
                        </div>
                        <div class="debt-status-indicator ${debt.status}"></div>
                    </div>
                    <div class="debt-card-info">
                        <div class="debt-info-item">
                            <div class="debt-info-label">Всего</div>
                            <div class="debt-info-value">${this.formatMoney(debt.total_amount)} руб.</div>
                        </div>
                        <div class="debt-info-item">
                            <div class="debt-info-label">Выплачено</div>
                            <div class="debt-info-value">${this.formatMoney(paidAmount)} руб.</div>
                        </div>
                        <div class="debt-info-item">
                            <div class="debt-info-label">Осталось</div>
                            <div class="debt-info-value">${this.formatMoney(remainingAmount)} руб.</div>
                        </div>
                        <div class="debt-info-item">
                            <div class="debt-info-label">Срок</div>
                            <div class="debt-info-value">${this.formatDate(debt.due_date)}</div>
                        </div>
                    </div>
                    <div class="debt-progress">
                        <div class="debt-progress-bar" style="width: ${progressPercent}%"></div>
                    </div>
                `;
                
                card.addEventListener('click', () => this.openFullscreenDebt(debt.id));
                container.appendChild(card);
            });
        },
        
        openFullscreenDebt(debtId) {
            this.currentDebtId = debtId;
            const debt = window.stateManager.getState('debts').find(d => d.id === debtId);
            
            if (!debt) return;
            
            document.getElementById('debt-fullscreen-title').textContent = debt.name;
            document.getElementById('debt-fullscreen').classList.remove('hidden');
            
            this.updateDebtInfo();
            this.renderPayments();
            this.hideEditForm();
        },
        
        closeFullscreenDebt() {
            document.getElementById('debt-fullscreen').classList.add('hidden');
            this.currentDebtId = null;
            this.hideEditForm();
        },
        
        updateDebtInfo() {
            if (!this.currentDebtId) return;
            
            const debt = window.stateManager.getState('debts').find(d => d.id === this.currentDebtId);
            if (!debt) return;
            
            const payments = window.stateManager.getState('debtPayments').filter(p => p.debt_id === this.currentDebtId);
            const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const remainingAmount = parseFloat(debt.total_amount) - paidAmount;
            
            document.getElementById('debt-total-amount').textContent = `${this.formatMoney(debt.total_amount)} руб.`;
            document.getElementById('debt-paid-amount').textContent = `${this.formatMoney(paidAmount)} руб.`;
            document.getElementById('debt-remaining-amount').textContent = `${this.formatMoney(remainingAmount)} руб.`;
            document.getElementById('debt-due-date').textContent = this.formatDate(debt.due_date);
            
            const statusBadge = document.getElementById('debt-status');
            statusBadge.textContent = this.getStatusText(debt.status);
            statusBadge.className = `debt-status-badge ${debt.status}`;
        },
        
        renderPayments() {
            if (!this.currentDebtId) return;
            
            const container = document.getElementById('payments-list');
            const payments = window.stateManager.getState('debtPayments').filter(p => p.debt_id === this.currentDebtId);
            
            container.innerHTML = '';
            if (payments.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>Нет платежей</p></div>';
            } else {
                payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
                payments.forEach(payment => {
                    container.appendChild(this.createPaymentItem(payment));
                });
            }
            
            const paymentDateInput = document.querySelector('input[name="payment-date"]');
            if (paymentDateInput) {
                paymentDateInput.value = new Date().toISOString().split('T')[0];
            }
        },
        
        createPaymentItem(payment) {
            const item = document.createElement('div');
            item.className = 'payment-item';
            item.innerHTML = `
                <div class="payment-info">
                    <div class="payment-amount">${this.formatMoney(payment.amount)} руб.</div>
                    <div class="payment-date">${this.formatDate(payment.payment_date)}</div>
                    ${payment.note ? `<div class="payment-note">${payment.note}</div>` : ''}
                </div>
                <div class="payment-actions">
                    <button class="btn-icon edit" data-payment-id="${payment.id}" title="Редактировать">✏️</button>
                    <button class="btn-icon delete" data-payment-id="${payment.id}" title="Удалить">🗑️</button>
                </div>
            `;
            
            item.querySelector('.edit').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPaymentEditModal(payment);
            });
            
            item.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showConfirm('Удалить платеж?', 'Вы уверены, что хотите удалить этот платеж?', () => {
                    this.deletePayment(payment.id);
                }, 'danger');
            });
            
            return item;
        },
        
        updateSummary() {
            const debts = window.stateManager.getState('debts');
            const payments = window.stateManager.getState('debtPayments');
            
            const totalDebts = debts.reduce((sum, debt) => sum + parseFloat(debt.total_amount), 0);
            const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
            const totalRemaining = totalDebts - totalPaid;
            
            document.getElementById('total-debts').textContent = `${this.formatMoney(totalDebts)} руб.`;
            document.getElementById('paid-amount').textContent = `${this.formatMoney(totalPaid)} руб.`;
            document.getElementById('remaining-amount').textContent = `${this.formatMoney(totalRemaining)} руб.`;
        },
        
        updateStatistics() {
            const debts = window.stateManager.getState('debts');
            const payments = window.stateManager.getState('debtPayments');
            
            const totalDebtsCount = debts.length;
            const paidDebts = debts.filter(d => d.status === 'paid').length;
            const activeDebts = debts.filter(d => d.status === 'active').length;
            const overdueDebts = debts.filter(d => d.status === 'overdue').length;
            
            const stats = {
                'stat-total-debts-count': totalDebtsCount,
                'stat-paid-debts': paidDebts,
                'stat-active-debts': activeDebts,
                'stat-overdue-debts': overdueDebts
            };
            
            Object.entries(stats).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
        },
        
        showNewDebtModal() {
            document.getElementById('new-debt-modal').classList.remove('hidden');
            document.getElementById('new-debt-name').focus();
            document.getElementById('new-debt-due-date').value = '';
        },
        
        hideNewDebtModal() {
            document.getElementById('new-debt-modal').classList.add('hidden');
            document.getElementById('new-debt-form').reset();
        },
        
        async createDebt(form) {
            const formData = new FormData(form);
            const data = {
                name: formData.get('new-debt-name'),
                creditor: formData.get('new-debt-creditor'),
                total_amount: parseFloat(formData.get('new-debt-amount')),
                due_date: formData.get('new-debt-due-date'),
                description: formData.get('new-debt-description')
            };
            
            this.showLoader(true);
            
            try {
                const debt = await window.apiClient.debts.create(data);
                
                const debts = window.stateManager.getState('debts');
                debts.push(debt);
                window.stateManager.setState('debts', debts);
                
                this.hideNewDebtModal();
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
            
            document.getElementById('debt-info').classList.add('hidden');
            document.getElementById('debt-edit-form').classList.remove('hidden');
            
            document.getElementById('edit-debt-name').value = debt.name;
            document.getElementById('edit-debt-creditor').value = debt.creditor;
            document.getElementById('edit-debt-amount').value = debt.total_amount;
            document.getElementById('edit-debt-due-date').value = new Date(debt.due_date).toISOString().split('T')[0];
            document.getElementById('edit-debt-description').value = debt.description || '';
        },
        
        hideEditForm() {
            document.getElementById('debt-info').classList.remove('hidden');
            document.getElementById('debt-edit-form').classList.add('hidden');
        },
        
        async saveDebt() {
            if (!this.currentDebtId) return;
            
            const data = {
                name: document.getElementById('edit-debt-name').value,
                creditor: document.getElementById('edit-debt-creditor').value,
                total_amount: parseFloat(document.getElementById('edit-debt-amount').value),
                due_date: document.getElementById('edit-debt-due-date').value,
                description: document.getElementById('edit-debt-description').value
            };
            
            this.showLoader(true);
            
            try {
                const updated = await window.apiClient.debts.update(this.currentDebtId, data);
                
                const debts = window.stateManager.getState('debts');
                const index = debts.findIndex(d => d.id === this.currentDebtId);
                debts[index] = updated;
                window.stateManager.setState('debts', debts);
                
                document.getElementById('debt-fullscreen-title').textContent = data.name;
                
                this.hideEditForm();
                this.showToast('Изменения сохранены', 'success');
            } catch (error) {
                this.showToast('Ошибка сохранения', 'error');
            } finally {
                this.showLoader(false);
            }
        },
        
        async deleteDebt() {
            if (!this.currentDebtId) return;
            
            this.showLoader(true);
            
            try {
                await window.apiClient.debts.delete(this.currentDebtId);
                
                const debts = window.stateManager.getState('debts').filter(d => d.id !== this.currentDebtId);
                const payments = window.stateManager.getState('debtPayments').filter(p => p.debt_id !== this.currentDebtId);
                
                window.stateManager.setState('debts', debts);
                window.stateManager.setState('debtPayments', payments);
                
                this.closeFullscreenDebt();
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
                debt_id: this.currentDebtId,
                amount: parseFloat(formData.get('payment-amount')),
                payment_date: formData.get('payment-date'),
                note: formData.get('payment-note')
            };
            
            this.showLoader(true);
            
            try {
                const payment = await window.apiClient.debtPayments.create(data);
                
                const payments = window.stateManager.getState('debtPayments');
                payments.push(payment);
                window.stateManager.setState('debtPayments', payments);
                
                await this.checkAndUpdateDebtStatus();
                
                form.reset();
                this.showToast('Платеж добавлен', 'success');
            } catch (error) {
                this.showToast('Ошибка добавления платежа', 'error');
            } finally {
                this.showLoader(false);
            }
        },
        
        showPaymentEditModal(payment) {
            this.editingPaymentId = payment.id;
            
            document.getElementById('edit-payment-id').value = payment.id;
            document.getElementById('edit-payment-amount').value = payment.amount;
            document.getElementById('edit-payment-date').value = new Date(payment.payment_date).toISOString().split('T')[0];
            document.getElementById('edit-payment-note').value = payment.note || '';
            
            document.getElementById('payment-edit-modal').classList.remove('hidden');
            document.getElementById('edit-payment-amount').focus();
        },
        
        hidePaymentEditModal() {
            document.getElementById('payment-edit-modal').classList.add('hidden');
            document.getElementById('payment-edit-form').reset();
            this.editingPaymentId = null;
        },
        
        async updatePayment(form) {
            const formData = new FormData(form);
            const paymentId = formData.get('edit-payment-id');
            
            const data = {
                amount: parseFloat(formData.get('edit-payment-amount')),
                payment_date: formData.get('edit-payment-date'),
                note: formData.get('edit-payment-note')
            };
            
            this.showLoader(true);
            
            try {
                const updated = await window.apiClient.debtPayments.update(paymentId, data);
                
                const payments = window.stateManager.getState('debtPayments');
                const index = payments.findIndex(p => p.id === parseInt(paymentId));
                if (index !== -1) {
                    payments[index] = { ...payments[index], ...updated };
                    window.stateManager.setState('debtPayments', payments);
                }
                
                await this.checkAndUpdateDebtStatus();
                
                this.hidePaymentEditModal();
                this.showToast('Платеж обновлен', 'success');
            } catch (error) {
                this.showToast('Ошибка обновления платежа', 'error');
            } finally {
                this.showLoader(false);
            }
        },
        
        async deletePayment(paymentId) {
            this.showLoader(true);
            
            try {
                await window.apiClient.debtPayments.delete(paymentId);
                
                const payments = window.stateManager.getState('debtPayments').filter(p => p.id !== paymentId);
                window.stateManager.setState('debtPayments', payments);
                
                await this.checkAndUpdateDebtStatus();
                
                this.showToast('Платеж удален', 'success');
            } catch (error) {
                this.showToast('Ошибка удаления платежа', 'error');
            } finally {
                this.showLoader(false);
            }
        },
        
        async checkAndUpdateDebtStatus() {
            if (!this.currentDebtId) return;
            
            const debt = window.stateManager.getState('debts').find(d => d.id === this.currentDebtId);
            if (!debt) return;
            
            const payments = window.stateManager.getState('debtPayments').filter(p => p.debt_id === this.currentDebtId);
            const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            
            let newStatus = debt.status;
            
            if (paidAmount >= parseFloat(debt.total_amount)) {
                newStatus = 'paid';
            } else if (new Date(debt.due_date) < new Date() && paidAmount < parseFloat(debt.total_amount)) {
                newStatus = 'overdue';
            } else {
                newStatus = 'active';
            }
            
            if (newStatus !== debt.status) {
                try {
                    const updated = await window.apiClient.debts.updateStatus(this.currentDebtId, newStatus);
                    
                    const debts = window.stateManager.getState('debts');
                    const index = debts.findIndex(d => d.id === this.currentDebtId);
                    debts[index] = { ...debts[index], status: newStatus };
                    window.stateManager.setState('debts', debts);
                } catch (error) {
                    console.error('Error updating debt status:', error);
                }
            }
        },
        
        showExportModal() {
            if (!this.currentDebtId) return;
            
            const debt = window.stateManager.getState('debts').find(d => d.id === this.currentDebtId);
            if (!debt) return;
            
            const payments = window.stateManager.getState('debtPayments').filter(p => p.debt_id === this.currentDebtId);
            const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const remainingAmount = parseFloat(debt.total_amount) - paidAmount;
            
            let exportText = `ДОЛГ: ${debt.name}\n`;
            exportText += `Кредитор: ${debt.creditor}\n`;
            exportText += `Статус: ${this.getStatusText(debt.status)}\n`;
            exportText += `=====================================\n\n`;
            exportText += `Общая сумма: ${this.formatMoney(debt.total_amount)} руб.\n`;
            exportText += `Выплачено: ${this.formatMoney(paidAmount)} руб.\n`;
            exportText += `Осталось: ${this.formatMoney(remainingAmount)} руб.\n`;
            exportText += `Срок погашения: ${this.formatDate(debt.due_date)}\n\n`;
            
            if (debt.description) {
                exportText += `Описание: ${debt.description}\n\n`;
            }
            
            if (payments.length > 0) {
                exportText += `ИСТОРИЯ ПЛАТЕЖЕЙ:\n`;
                exportText += `=====================================\n`;
                payments.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
                payments.forEach((payment, index) => {
                    exportText += `${index + 1}. ${this.formatMoney(payment.amount)} руб. - ${this.formatDate(payment.payment_date)}`;
                    if (payment.note) {
                        exportText += ` (${payment.note})`;
                    }
                    exportText += '\n';
                });
            }
            
            this.exportData = exportText;
            document.getElementById('export-preview').textContent = exportText;
            document.getElementById('export-modal').classList.remove('hidden');
        },
        
        getStatusText(status) {
            const statusMap = {
                'active': 'Активный',
                'paid': 'Выплачен',
                'overdue': 'Просрочен'
            };
            return statusMap[status] || status;
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
    
    window.moduleManager.register(DebtsModule);
})();

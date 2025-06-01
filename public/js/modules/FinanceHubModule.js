(function() {
    'use strict';
    
    const FinanceHubModule = {
        id: 'finance-hub',
        name: 'Finance Hub',
        version: '1.0.0',
        
        init() {
            if (this.initialized) return;
            
            this.initialized = true;
        },
        
        async activate() {
            await this.updatePreviews();
            this.render();
        },
        
        render() {
            const nav = document.getElementById('main-nav');
            nav.classList.remove('hidden');
            
            const user = window.stateManager.getState('user');
            if (user) {
                document.getElementById('user-email').textContent = user.email;
            }
            
            ['auth-module', 'home-module', 'coco-money-module', 'debts-module'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            
            const financeHub = document.getElementById('finance-hub-module');
            if (financeHub) financeHub.classList.remove('hidden');
            
            ['sheet-fullscreen', 'debt-fullscreen'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
        },
        
        async updatePreviews() {
            try {
                const sheets = await window.apiClient.incomeSheets.getAll();
                const activeSheets = sheets.filter(s => !s.is_preliminary && !s.exclude_from_balance);
                const expenses = [];
                
                for (const sheet of activeSheets) {
                    const sheetExpenses = await window.apiClient.expenses.getBySheet(sheet.id);
                    expenses.push(...sheetExpenses.filter(e => !e.is_preliminary));
                }
                
                const totalIncome = activeSheets.reduce((sum, sheet) => sum + parseFloat(sheet.income_amount), 0);
                const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
                const balance = totalIncome - totalExpenses;
                
                const balanceEl = document.getElementById('money-balance-preview');
                if (balanceEl) {
                    balanceEl.textContent = `Баланс: ${this.formatMoney(balance)} руб.`;
                }
            } catch (error) {
                const balanceEl = document.getElementById('money-balance-preview');
                if (balanceEl) {
                    balanceEl.textContent = 'Баланс: 0 руб.';
                }
            }
            
            try {
                const debts = await window.apiClient.debts.getAll();
                const activeDebts = debts.filter(d => d.status !== 'paid');
                const totalDebt = activeDebts.reduce((sum, debt) => {
                    return sum + (parseFloat(debt.total_amount) - parseFloat(debt.paid_amount || 0));
                }, 0);
                
                const debtsEl = document.getElementById('debts-total-preview');
                if (debtsEl) {
                    debtsEl.textContent = `Всего долгов: ${this.formatMoney(totalDebt)} руб.`;
                }
            } catch (error) {
                const debtsEl = document.getElementById('debts-total-preview');
                if (debtsEl) {
                    debtsEl.textContent = 'Всего долгов: 0 руб.';
                }
            }
        },
        
        formatMoney(amount) {
            return new Intl.NumberFormat('ru-RU').format(amount);
        }
    };
    
    window.moduleManager.register(FinanceHubModule);
})();

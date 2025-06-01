const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticateToken);

router.get('/:debtId', asyncHandler(async (req, res) => {
    const { debtId } = req.params;
    
    const checkResult = await query(
        'SELECT id FROM debts WHERE id = $1 AND user_id = $2',
        [debtId, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Долг не найден', 404);
    }
    
    const result = await query(
        `SELECT id, debt_id, amount, payment_date, note, created_at, updated_at 
         FROM debt_payments 
         WHERE debt_id = $1 
         ORDER BY payment_date DESC, created_at DESC`,
        [debtId]
    );
    
    res.json(result.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
    const { debt_id, amount, payment_date, note } = req.body;
    
    if (!debt_id || amount === undefined || !payment_date) {
        throw new AppError('ID долга, сумма и дата платежа обязательны', 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Сумма платежа должна быть положительным числом', 400);
    }
    
    const checkResult = await query(
        'SELECT id, total_amount, status FROM debts WHERE id = $1 AND user_id = $2',
        [debt_id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Долг не найден', 404);
    }
    
    const debt = checkResult.rows[0];
    
    const paymentsResult = await query(
        'SELECT COALESCE(SUM(amount), 0) as paid_amount FROM debt_payments WHERE debt_id = $1',
        [debt_id]
    );
    
    const currentPaidAmount = parseFloat(paymentsResult.rows[0].paid_amount);
    const remainingAmount = parseFloat(debt.total_amount) - currentPaidAmount;
    
    if (amount > remainingAmount) {
        throw new AppError(`Сумма платежа превышает остаток долга (${remainingAmount} руб.)`, 400);
    }
    
    const result = await query(
        `INSERT INTO debt_payments (debt_id, amount, payment_date, note) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, debt_id, amount, payment_date, note, created_at, updated_at`,
        [debt_id, amount, payment_date, note?.trim() || null]
    );
    
    const newPaidAmount = currentPaidAmount + amount;
    if (newPaidAmount >= parseFloat(debt.total_amount)) {
        await query(
            'UPDATE debts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['paid', debt_id]
        );
    }
    
    res.status(201).json(result.rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, payment_date, note } = req.body;
    
    if (amount === undefined || !payment_date) {
        throw new AppError('Сумма и дата платежа обязательны', 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Сумма платежа должна быть положительным числом', 400);
    }
    
    const checkResult = await query(
        `SELECT p.id, p.debt_id, p.amount as old_amount, d.total_amount, d.user_id 
         FROM debt_payments p 
         JOIN debts d ON p.debt_id = d.id 
         WHERE p.id = $1 AND d.user_id = $2`,
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Платеж не найден', 404);
    }
    
    const payment = checkResult.rows[0];
    
    const paymentsResult = await query(
        'SELECT COALESCE(SUM(amount), 0) as paid_amount FROM debt_payments WHERE debt_id = $1 AND id != $2',
        [payment.debt_id, id]
    );
    
    const otherPaymentsAmount = parseFloat(paymentsResult.rows[0].paid_amount);
    const maxAllowedAmount = parseFloat(payment.total_amount) - otherPaymentsAmount;
    
    if (amount > maxAllowedAmount) {
        throw new AppError(`Сумма платежа превышает остаток долга (${maxAllowedAmount} руб.)`, 400);
    }
    
    const result = await query(
        `UPDATE debt_payments 
         SET amount = $1, payment_date = $2, note = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING id, debt_id, amount, payment_date, note, created_at, updated_at`,
        [amount, payment_date, note?.trim() || null, id]
    );
    
    const newTotalPaid = otherPaymentsAmount + amount;
    if (newTotalPaid >= parseFloat(payment.total_amount)) {
        await query(
            'UPDATE debts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['paid', payment.debt_id]
        );
    } else {
        await query(
            'UPDATE debts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = $3',
            ['active', payment.debt_id, 'paid']
        );
    }
    
    res.json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const checkResult = await query(
        `SELECT p.id, p.debt_id 
         FROM debt_payments p 
         JOIN debts d ON p.debt_id = d.id 
         WHERE p.id = $1 AND d.user_id = $2`,
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Платеж не найден', 404);
    }
    
    const debtId = checkResult.rows[0].debt_id;
    
    await query('DELETE FROM debt_payments WHERE id = $1', [id]);
    
    const paymentsResult = await query(
        'SELECT COALESCE(SUM(amount), 0) as paid_amount FROM debt_payments WHERE debt_id = $1',
        [debtId]
    );
    
    const debtResult = await query(
        'SELECT total_amount, due_date FROM debts WHERE id = $1',
        [debtId]
    );
    
    if (debtResult.rows.length > 0) {
        const debt = debtResult.rows[0];
        const paidAmount = parseFloat(paymentsResult.rows[0].paid_amount);
        let newStatus = 'active';
        
        if (paidAmount >= parseFloat(debt.total_amount)) {
            newStatus = 'paid';
        } else if (new Date(debt.due_date) < new Date()) {
            newStatus = 'overdue';
        }
        
        await query(
            'UPDATE debts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newStatus, debtId]
        );
    }
    
    res.json({ message: 'Платеж удалён' });
}));

module.exports = router;

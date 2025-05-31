const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticateToken);

router.get('/', asyncHandler(async (req, res) => {
    const debtsResult = await query(
        `SELECT d.*, 
         COALESCE(json_agg(
            json_build_object(
                'id', p.id,
                'amount', p.amount,
                'date', p.payment_date,
                'comment', p.comment
            ) ORDER BY p.payment_date DESC
         ) FILTER (WHERE p.id IS NOT NULL), '[]') as payments
         FROM debts d
         LEFT JOIN debt_payments p ON d.id = p.debt_id
         WHERE d.user_id = $1
         GROUP BY d.id
         ORDER BY d.due_date ASC`,
        [req.user.id]
    );
    
    res.json(debtsResult.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
    const {
        creditor_name,
        creditor_type,
        amount,
        currency = 'RUB',
        description,
        due_date,
        category,
        priority = 2,
        contact_info
    } = req.body;
    
    if (!creditor_name || !amount || !due_date) {
        throw new AppError('Имя кредитора, сумма и срок обязательны', 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Сумма должна быть положительным числом', 400);
    }
    
    if (priority < 1 || priority > 3) {
        throw new AppError('Приоритет должен быть от 1 до 3', 400);
    }
    
    const result = await query(
        `INSERT INTO debts (
            user_id, creditor_name, creditor_type, amount, currency,
            description, due_date, category, priority, contact_info
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
            req.user.id,
            creditor_name.trim(),
            creditor_type || 'другое',
            amount,
            currency,
            description ? description.trim() : null,
            due_date,
            category || 'Общее',
            priority,
            contact_info ? contact_info.trim() : null
        ]
    );
    
    const debt = result.rows[0];
    debt.payments = [];
    
    res.status(201).json(debt);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        creditor_name,
        creditor_type,
        amount,
        currency,
        description,
        due_date,
        category,
        priority,
        contact_info,
        status
    } = req.body;
    
    if (!creditor_name || !amount || !due_date) {
        throw new AppError('Имя кредитора, сумма и срок обязательны', 400);
    }
    
    const checkResult = await query(
        'SELECT id FROM debts WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Долг не найден', 404);
    }
    
    const result = await query(
        `UPDATE debts SET
            creditor_name = $1,
            creditor_type = $2,
            amount = $3,
            currency = $4,
            description = $5,
            due_date = $6,
            category = $7,
            priority = $8,
            contact_info = $9,
            status = $10,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11 AND user_id = $12
        RETURNING *`,
        [
            creditor_name.trim(),
            creditor_type || 'другое',
            amount,
            currency || 'RUB',
            description ? description.trim() : null,
            due_date,
            category || 'Общее',
            priority || 2,
            contact_info ? contact_info.trim() : null,
            status || 'active',
            id,
            req.user.id
        ]
    );
    
    res.json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const checkResult = await query(
        'SELECT id FROM debts WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Долг не найден', 404);
    }
    
    await query('DELETE FROM debts WHERE id = $1', [id]);
    
    res.json({ message: 'Долг удалён' });
}));

router.post('/:id/payments', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, comment } = req.body;
    
    if (!amount || amount <= 0) {
        throw new AppError('Сумма платежа должна быть положительной', 400);
    }
    
    const debtResult = await query(
        'SELECT id, amount, status FROM debts WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (debtResult.rows.length === 0) {
        throw new AppError('Долг не найден', 404);
    }
    
    const debt = debtResult.rows[0];
    
    const paymentResult = await query(
        `INSERT INTO debt_payments (debt_id, amount, comment)
         VALUES ($1, $2, $3)
         RETURNING id, amount, payment_date as date, comment`,
        [id, amount, comment ? comment.trim() : null]
    );
    
    const paymentsResult = await query(
        'SELECT COALESCE(SUM(amount), 0) as total FROM debt_payments WHERE debt_id = $1',
        [id]
    );
    
    const totalPaid = parseFloat(paymentsResult.rows[0].total);
    let newStatus = debt.status;
    
    if (totalPaid >= debt.amount) {
        newStatus = 'paid';
    } else if (totalPaid > 0) {
        newStatus = 'partial';
    }
    
    if (newStatus !== debt.status) {
        await query(
            'UPDATE debts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newStatus, id]
        );
    }
    
    res.status(201).json(paymentResult.rows[0]);
}));

module.exports = router;

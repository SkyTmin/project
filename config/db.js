const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Применяем middleware аутентификации
router.use(authenticateToken);

// Получить все долги пользователя
router.get('/', asyncHandler(async (req, res) => {
    console.log('GET /api/debts - User ID:', req.user.id);
    
    try {
        const result = await query(
            `SELECT id, name, creditor, total_amount, due_date, description, status, created_at, updated_at 
             FROM debts 
             WHERE user_id = $1 
             ORDER BY 
                CASE status 
                    WHEN 'overdue' THEN 1 
                    WHEN 'active' THEN 2 
                    WHEN 'paid' THEN 3 
                END, 
                due_date ASC`,
            [req.user.id]
        );
        
        // Обновляем статусы просроченных долгов
        const now = new Date();
        for (const debt of result.rows) {
            if (debt.status === 'active' && new Date(debt.due_date) < now) {
                await query(
                    'UPDATE debts SET status = $1 WHERE id = $2',
                    ['overdue', debt.id]
                );
                debt.status = 'overdue';
            }
        }
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error in GET /api/debts:', error);
        throw error;
    }
}));

// Создать новый долг
router.post('/', asyncHandler(async (req, res) => {
    console.log('POST /api/debts - Body:', req.body);
    
    const { name, creditor, total_amount, due_date, description } = req.body;
    
    if (!name || !creditor || total_amount === undefined || !due_date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    if (typeof total_amount !== 'number' || total_amount <= 0) {
        throw new AppError('Сумма долга должна быть положительным числом', 400);
    }
    
    if (name.trim().length === 0 || creditor.trim().length === 0) {
        throw new AppError('Название и кредитор не могут быть пустыми', 400);
    }
    
    const dueDate = new Date(due_date);
    const status = dueDate < new Date() ? 'overdue' : 'active';
    
    try {
        const result = await query(
            `INSERT INTO debts (user_id, name, creditor, total_amount, due_date, description, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id, name, creditor, total_amount, due_date, description, status, created_at, updated_at`,
            [req.user.id, name.trim(), creditor.trim(), total_amount, due_date, description?.trim() || null, status]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in POST /api/debts:', error);
        throw error;
    }
}));

// Обновить долг
router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, creditor, total_amount, due_date, description } = req.body;
    
    if (!name || !creditor || total_amount === undefined || !due_date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    if (typeof total_amount !== 'number' || total_amount <= 0) {
        throw new AppError('Сумма долга должна быть положительным числом', 400);
    }
    
    try {
        // Проверяем, существует ли долг
        const checkResult = await query(
            'SELECT id, total_amount FROM debts WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (checkResult.rows.length === 0) {
            throw new AppError('Долг не найден', 404);
        }
        
        // Получаем сумму платежей
        const paymentsResult = await query(
            'SELECT COALESCE(SUM(amount), 0) as paid_amount FROM debt_payments WHERE debt_id = $1',
            [id]
        );
        
        const paidAmount = parseFloat(paymentsResult.rows[0].paid_amount);
        let status = 'active';
        
        if (paidAmount >= total_amount) {
            status = 'paid';
        } else if (new Date(due_date) < new Date()) {
            status = 'overdue';
        }
        
        const result = await query(
            `UPDATE debts 
             SET name = $1, creditor = $2, total_amount = $3, due_date = $4, description = $5, status = $6, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $7 AND user_id = $8 
             RETURNING id, name, creditor, total_amount, due_date, description, status, created_at, updated_at`,
            [name.trim(), creditor.trim(), total_amount, due_date, description?.trim() || null, status, id, req.user.id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in PUT /api/debts/:id:', error);
        throw error;
    }
}));

// Обновить статус долга
router.put('/:id/status', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'paid', 'overdue'].includes(status)) {
        throw new AppError('Недопустимый статус', 400);
    }
    
    try {
        const checkResult = await query(
            'SELECT id FROM debts WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (checkResult.rows.length === 0) {
            throw new AppError('Долг не найден', 404);
        }
        
        const result = await query(
            'UPDATE debts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING status',
            [status, id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in PUT /api/debts/:id/status:', error);
        throw error;
    }
}));

// Удалить долг
router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        const checkResult = await query(
            'SELECT id FROM debts WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (checkResult.rows.length === 0) {
            throw new AppError('Долг не найден', 404);
        }
        
        await query('DELETE FROM debts WHERE id = $1', [id]);
        
        res.json({ message: 'Долг удалён' });
    } catch (error) {
        console.error('Error in DELETE /api/debts/:id:', error);
        throw error;
    }
}));

module.exports = router;

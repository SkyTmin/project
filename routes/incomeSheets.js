const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticateToken);

router.get('/', asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT id, name, income_amount, date, exclude_from_balance, is_preliminary, created_at, updated_at 
         FROM income_sheets 
         WHERE user_id = $1 
         ORDER BY is_preliminary, date DESC, created_at DESC`,
        [req.user.id]
    );
    res.json(result.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
    const { name, income_amount, date, exclude_from_balance = false, is_preliminary = false } = req.body;
    
    if (!name || income_amount === undefined || !date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    if (typeof income_amount !== 'number' || income_amount < 0) {
        throw new AppError('Сумма дохода должна быть положительным числом', 400);
    }
    
    if (name.trim().length === 0) {
        throw new AppError('Название не может быть пустым', 400);
    }
    
    const result = await query(
        `INSERT INTO income_sheets (user_id, name, income_amount, date, exclude_from_balance, is_preliminary) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, name, income_amount, date, exclude_from_balance, is_preliminary, created_at, updated_at`,
        [req.user.id, name.trim(), income_amount, date, exclude_from_balance, is_preliminary]
    );
    
    res.status(201).json(result.rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, income_amount, date, exclude_from_balance, is_preliminary } = req.body;
    
    if (!name || income_amount === undefined || !date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    if (typeof income_amount !== 'number' || income_amount < 0) {
        throw new AppError('Сумма дохода должна быть положительным числом', 400);
    }
    
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    const result = await query(
        `UPDATE income_sheets 
         SET name = $1, income_amount = $2, date = $3, exclude_from_balance = $4, is_preliminary = $5, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $6 AND user_id = $7 
         RETURNING id, name, income_amount, date, exclude_from_balance, is_preliminary, created_at, updated_at`,
        [name.trim(), income_amount, date, exclude_from_balance || false, is_preliminary || false, id, req.user.id]
    );
    
    res.json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    await query('DELETE FROM income_sheets WHERE id = $1', [id]);
    
    res.json({ message: 'Лист доходов удалён' });
}));

module.exports = router;

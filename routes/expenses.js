const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticateToken);

router.get('/:sheetId', asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [sheetId, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    const result = await query(
        `SELECT id, income_sheet_id, amount, note, is_preliminary, created_at, updated_at 
         FROM expenses 
         WHERE income_sheet_id = $1 
         ORDER BY is_preliminary, created_at DESC`,
        [sheetId]
    );
    
    res.json(result.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
    const { income_sheet_id, amount, note, is_preliminary = false } = req.body;
    
    if (!income_sheet_id || amount === undefined) {
        throw new AppError('ID листа и сумма обязательны', 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Сумма должна быть положительным числом', 400);
    }
    
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [income_sheet_id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    const result = await query(
        `INSERT INTO expenses (income_sheet_id, amount, note, is_preliminary) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, income_sheet_id, amount, note, is_preliminary, created_at, updated_at`,
        [income_sheet_id, amount, note ? note.trim() : null, is_preliminary]
    );
    
    res.status(201).json(result.rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, note, is_preliminary } = req.body;
    
    if (amount === undefined) {
        throw new AppError('Сумма обязательна', 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Сумма должна быть положительным числом', 400);
    }
    
    const checkResult = await query(
        `SELECT e.id 
         FROM expenses e 
         JOIN income_sheets s ON e.income_sheet_id = s.id 
         WHERE e.id = $1 AND s.user_id = $2`,
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Расход не найден', 404);
    }
    
    const result = await query(
        `UPDATE expenses 
         SET amount = $1, note = $2, is_preliminary = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING id, income_sheet_id, amount, note, is_preliminary, created_at, updated_at`,
        [amount, note ? note.trim() : null, is_preliminary || false, id]
    );
    
    res.json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const checkResult = await query(
        `SELECT e.id 
         FROM expenses e 
         JOIN income_sheets s ON e.income_sheet_id = s.id 
         WHERE e.id = $1 AND s.user_id = $2`,
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Расход не найден', 404);
    }
    
    await query('DELETE FROM expenses WHERE id = $1', [id]);
    
    res.json({ message: 'Расход удалён' });
}));

module.exports = router;

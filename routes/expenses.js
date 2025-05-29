// routes/expenses.js - Маршруты для работы с расходами
const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// Получить расходы для листа доходов
router.get('/:sheetId', asyncHandler(async (req, res) => {
    const { sheetId } = req.params;
    
    // Проверяем, что лист принадлежит пользователю
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [sheetId, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    // Получаем расходы
    const result = await query(
        `SELECT id, income_sheet_id, amount, note, is_preliminary, created_at, updated_at 
         FROM expenses 
         WHERE income_sheet_id = $1 
         ORDER BY is_preliminary, created_at DESC`,
        [sheetId]
    );
    
    res.json(result.rows);
}));

// Создать новый расход
router.post('/', asyncHandler(async (req, res) => {
    const { income_sheet_id, amount, note, is_preliminary = false } = req.body;
    
    // Валидация
    if (!income_sheet_id || amount === undefined) {
        throw new AppError('ID листа и сумма обязательны', 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Сумма должна быть положительным числом', 400);
    }
    
    // Проверяем, что лист принадлежит пользователю
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [income_sheet_id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    // Создаём расход
    const result = await query(
        `INSERT INTO expenses (income_sheet_id, amount, note, is_preliminary) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, income_sheet_id, amount, note, is_preliminary, created_at, updated_at`,
        [income_sheet_id, amount, note ? note.trim() : null, is_preliminary]
    );
    
    res.status(201).json(result.rows[0]);
}));

// Обновить расход
router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, note, is_preliminary } = req.body;
    
    // Валидация
    if (amount === undefined) {
        throw new AppError('Сумма обязательна', 400);
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Сумма должна быть положительным числом', 400);
    }
    
    // Проверяем, что расход принадлежит пользователю через лист доходов
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
    
    // Обновляем расход
    const result = await query(
        `UPDATE expenses 
         SET amount = $1, note = $2, is_preliminary = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING id, income_sheet_id, amount, note, is_preliminary, created_at, updated_at`,
        [amount, note ? note.trim() : null, is_preliminary || false, id]
    );
    
    res.json(result.rows[0]);
}));

// Удалить расход
router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Проверяем, что расход принадлежит пользователю через лист доходов
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
    
    // Удаляем расход
    await query('DELETE FROM expenses WHERE id = $1', [id]);
    
    res.json({ message: 'Расход удалён' });
}));

// Получить статистику расходов пользователя
router.get('/stats/summary', asyncHandler(async (req, res) => {
    const { period } = req.query; // day, week, month, year
    
    let dateFilter = '';
    const params = [req.user.id];
    
    if (period) {
        switch (period) {
            case 'day':
                dateFilter = 'AND e.created_at >= CURRENT_DATE';
                break;
            case 'week':
                dateFilter = 'AND e.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
                break;
            case 'month':
                dateFilter = 'AND e.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
                break;
            case 'year':
                dateFilter = 'AND e.created_at >= CURRENT_DATE - INTERVAL \'1 year\'';
                break;
        }
    }
    
    const result = await query(
        `SELECT 
            COUNT(e.id) as total_count,
            COALESCE(SUM(e.amount), 0) as total_amount,
            COALESCE(AVG(e.amount), 0) as avg_amount,
            COALESCE(MAX(e.amount), 0) as max_amount,
            COALESCE(MIN(e.amount), 0) as min_amount
         FROM expenses e
         JOIN income_sheets s ON e.income_sheet_id = s.id
         WHERE s.user_id = $1 ${dateFilter}`,
        params
    );
    
    res.json({
        period: period || 'all',
        ...result.rows[0],
        total_amount: parseFloat(result.rows[0].total_amount),
        avg_amount: parseFloat(result.rows[0].avg_amount),
        max_amount: parseFloat(result.rows[0].max_amount),
        min_amount: parseFloat(result.rows[0].min_amount)
    });
}));

module.exports = router;

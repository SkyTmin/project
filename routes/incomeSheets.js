// routes/incomeSheets.js - Маршруты для работы с листами доходов
const express = require('express');
const { query } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// Получить все листы доходов пользователя
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

// Создать новый лист доходов
router.post('/', asyncHandler(async (req, res) => {
    const { name, income_amount, date, exclude_from_balance = false } = req.body;
    
    // Валидация
    if (!name || income_amount === undefined || !date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    if (typeof income_amount !== 'number' || income_amount < 0) {
        throw new AppError('Сумма дохода должна быть положительным числом', 400);
    }
    
    if (name.trim().length === 0) {
        throw new AppError('Название не может быть пустым', 400);
    }
    
    // Создаём лист
    const result = await query(
        `INSERT INTO income_sheets (user_id, name, income_amount, date, exclude_from_balance) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, name, income_amount, date, exclude_from_balance, created_at, updated_at`,
        [req.user.id, name.trim(), income_amount, date, exclude_from_balance]
    );
    
    res.status(201).json(result.rows[0]);
}));

// Обновить лист доходов
router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, income_amount, date, exclude_from_balance } = req.body;
    
    // Проверяем, что лист принадлежит пользователю
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    // Валидация
    if (!name || income_amount === undefined || !date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    if (typeof income_amount !== 'number' || income_amount < 0) {
        throw new AppError('Сумма дохода должна быть положительным числом', 400);
    }
    
    if (name.trim().length === 0) {
        throw new AppError('Название не может быть пустым', 400);
    }
    
    // Обновляем лист
    const result = await query(
        `UPDATE income_sheets 
         SET name = $1, income_amount = $2, date = $3, exclude_from_balance = $4, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5 AND user_id = $6 
         RETURNING id, name, income_amount, date, exclude_from_balance, created_at, updated_at`,
        [name.trim(), income_amount, date, exclude_from_balance || false, id, req.user.id]
    );
    
    res.json(result.rows[0]);
}));

// Удалить лист доходов
router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Проверяем, что лист принадлежит пользователю
    const checkResult = await query(
        'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    // Удаляем лист (расходы удалятся автоматически благодаря CASCADE)
    await query(
        'DELETE FROM income_sheets WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    res.json({ message: 'Лист доходов удалён' });
}));

// Получить статистику по листу
router.get('/:id/stats', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Получаем лист и проверяем права доступа
    const sheetResult = await query(
        'SELECT id, name, income_amount FROM income_sheets WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
    );
    
    if (sheetResult.rows.length === 0) {
        throw new AppError('Лист доходов не найден', 404);
    }
    
    const sheet = sheetResult.rows[0];
    
    // Получаем сумму расходов
    const expensesResult = await query(
        'SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE income_sheet_id = $1',
        [id]
    );
    
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses);
    const balance = parseFloat(sheet.income_amount) - totalExpenses;
    
    res.json({
        sheet_id: sheet.id,
        sheet_name: sheet.name,
        income: parseFloat(sheet.income_amount),
        expenses: totalExpenses,
        balance: balance
    });
}));

module.exports = router;

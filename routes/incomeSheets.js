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
    try {
        const result = await query(
            `SELECT id, name, income_amount, date, exclude_from_balance, is_preliminary, created_at, updated_at 
             FROM income_sheets 
             WHERE user_id = $1 
             ORDER BY is_preliminary, date DESC, created_at DESC`,
            [req.user.id]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching income sheets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));

// Создать новый лист доходов
router.post('/', asyncHandler(async (req, res) => {
    const { name, income_amount, date, exclude_from_balance = false } = req.body;
    
    try {
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
    } catch (error) {
        console.error('Error creating income sheet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));

module.exports = router;

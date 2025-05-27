// routes/incomeSheets.js - Маршруты для работы с листами доходов
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получить все листы доходов пользователя
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                is.id,
                is.name,
                is.income_amount,
                is.date,
                is.created_at,
                is.updated_at,
                COALESCE(SUM(e.amount), 0) as total_expenses,
                is.income_amount - COALESCE(SUM(e.amount), 0) as balance
            FROM income_sheets is
            LEFT JOIN expenses e ON is.id = e.income_sheet_id
            WHERE is.user_id = $1
            GROUP BY is.id
            ORDER BY is.date DESC, is.created_at DESC
        `, [req.userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get income sheets error:', error);
        res.status(500).json({ message: 'Ошибка при получении листов доходов' });
    }
});

// Получить конкретный лист доходов
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                is.id,
                is.name,
                is.income_amount,
                is.date,
                is.created_at,
                is.updated_at,
                COALESCE(SUM(e.amount), 0) as total_expenses,
                is.income_amount - COALESCE(SUM(e.amount), 0) as balance
            FROM income_sheets is
            LEFT JOIN expenses e ON is.id = e.income_sheet_id
            WHERE is.id = $1 AND is.user_id = $2
            GROUP BY is.id
        `, [id, req.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Лист доходов не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get income sheet error:', error);
        res.status(500).json({ message: 'Ошибка при получении листа доходов' });
    }
});

// Создать новый лист доходов
router.post('/', [
    body('name').notEmpty().trim(),
    body('income_amount').isNumeric(),
    body('date').isDate(),
], async (req, res) => {
    try {
        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, income_amount, date } = req.body;

        const result = await db.query(
            'INSERT INTO income_sheets (user_id, name, income_amount, date) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.userId, name, income_amount, date]
        );

        const incomeSheet = result.rows[0];
        
        // Добавляем поля для совместимости с GET запросом
        incomeSheet.total_expenses = 0;
        incomeSheet.balance = incomeSheet.income_amount;

        res.status(201).json(incomeSheet);
    } catch (error) {
        console.error('Create income sheet error:', error);
        res.status(500).json({ message: 'Ошибка при создании листа доходов' });
    }
});

// Обновить лист доходов
router.put('/:id', [
    body('name').optional().notEmpty().trim(),
    body('income_amount').optional().isNumeric(),
    body('date').optional().isDate(),
], async (req, res) => {
    try {
        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, income_amount, date } = req.body;

        // Проверяем, что лист принадлежит пользователю
        const checkResult = await db.query(
            'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
            [id, req.userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Лист доходов не найден' });
        }

        // Строим динамический запрос обновления
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount}`);
            values.push(name);
            paramCount++;
        }

        if (income_amount !== undefined) {
            updates.push(`income_amount = $${paramCount}`);
            values.push(income_amount);
            paramCount++;
        }

        if (date !== undefined) {
            updates.push(`date = $${paramCount}`);
            values.push(date);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Нет данных для обновления' });
        }

        values.push(id);
        values.push(req.userId);

        const updateQuery = `
            UPDATE income_sheets 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
            RETURNING *
        `;

        const result = await db.query(updateQuery, values);

        // Получаем обновленные данные с расходами
        const updatedResult = await db.query(`
            SELECT 
                is.id,
                is.name,
                is.income_amount,
                is.date,
                is.created_at,
                is.updated_at,
                COALESCE(SUM(e.amount), 0) as total_expenses,
                is.income_amount - COALESCE(SUM(e.amount), 0) as balance
            FROM income_sheets is
            LEFT JOIN expenses e ON is.id = e.income_sheet_id
            WHERE is.id = $1
            GROUP BY is.id
        `, [id]);

        res.json(updatedResult.rows[0]);
    } catch (error) {
        console.error('Update income sheet error:', error);
        res.status(500).json({ message: 'Ошибка при обновлении листа доходов' });
    }
});

// Удалить лист доходов
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM income_sheets WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Лист доходов не найден' });
        }

        res.json({ message: 'Лист доходов удален', id: result.rows[0].id });
    } catch (error) {
        console.error('Delete income sheet error:', error);
        res.status(500).json({ message: 'Ошибка при удалении листа доходов' });
    }
});

module.exports = router;
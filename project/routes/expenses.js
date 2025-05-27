// routes/expenses.js - Маршруты для работы с расходами
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получить расходы для листа доходов
router.get('/:sheetId', async (req, res) => {
    try {
        const { sheetId } = req.params;

        // Проверяем, что лист принадлежит пользователю
        const sheetCheck = await db.query(
            'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
            [sheetId, req.userId]
        );

        if (sheetCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Лист доходов не найден' });
        }

        // Получаем расходы
        const result = await db.query(
            'SELECT * FROM expenses WHERE income_sheet_id = $1 ORDER BY created_at DESC',
            [sheetId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ message: 'Ошибка при получении расходов' });
    }
});

// Создать новый расход
router.post('/', [
    body('income_sheet_id').isNumeric(),
    body('amount').isNumeric(),
    body('note').optional().trim(),
], async (req, res) => {
    try {
        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { income_sheet_id, amount, note } = req.body;

        // Проверяем, что лист принадлежит пользователю
        const sheetCheck = await db.query(
            'SELECT id FROM income_sheets WHERE id = $1 AND user_id = $2',
            [income_sheet_id, req.userId]
        );

        if (sheetCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Лист доходов не найден' });
        }

        // Создаем расход
        const result = await db.query(
            'INSERT INTO expenses (income_sheet_id, amount, note) VALUES ($1, $2, $3) RETURNING *',
            [income_sheet_id, amount, note || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({ message: 'Ошибка при создании расхода' });
    }
});

// Обновить расход
router.put('/:id', [
    body('amount').optional().isNumeric(),
    body('note').optional().trim(),
], async (req, res) => {
    try {
        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { amount, note } = req.body;

        // Проверяем, что расход принадлежит листу пользователя
        const checkResult = await db.query(`
            SELECT e.id 
            FROM expenses e
            JOIN income_sheets is ON e.income_sheet_id = is.id
            WHERE e.id = $1 AND is.user_id = $2
        `, [id, req.userId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Расход не найден' });
        }

        // Строим динамический запрос обновления
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (amount !== undefined) {
            updates.push(`amount = $${paramCount}`);
            values.push(amount);
            paramCount++;
        }

        if (note !== undefined) {
            updates.push(`note = $${paramCount}`);
            values.push(note || null);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Нет данных для обновления' });
        }

        values.push(id);

        const updateQuery = `
            UPDATE expenses 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await db.query(updateQuery, values);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({ message: 'Ошибка при обновлении расхода' });
    }
});

// Удалить расход
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Проверяем, что расход принадлежит листу пользователя
        const checkResult = await db.query(`
            SELECT e.id 
            FROM expenses e
            JOIN income_sheets is ON e.income_sheet_id = is.id
            WHERE e.id = $1 AND is.user_id = $2
        `, [id, req.userId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Расход не найден' });
        }

        // Удаляем расход
        await db.query('DELETE FROM expenses WHERE id = $1', [id]);

        res.json({ message: 'Расход удален', id: parseInt(id) });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({ message: 'Ошибка при удалении расхода' });
    }
});

module.exports = router;
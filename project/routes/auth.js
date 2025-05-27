// routes/auth.js - Маршруты аутентификации
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Регистрация
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('verification_date').isDate(),
], async (req, res) => {
    try {
        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, verification_date, remember } = req.body;

        // Проверяем, что дата - это вчера
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const inputDate = new Date(verification_date);
        inputDate.setHours(0, 0, 0, 0);
        
        if (inputDate.getTime() !== yesterday.getTime()) {
            return res.status(400).json({ message: 'Неверная дата верификации' });
        }

        // Проверяем, существует ли пользователь
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создаем пользователя
        const result = await db.query(
            'INSERT INTO users (email, password_hash, verification_date) VALUES ($1, $2, $3) RETURNING id, email',
            [email, hashedPassword, verification_date]
        );

        const user = result.rows[0];

        // Создаем JWT токен
        const tokenExpiry = remember ? '30d' : '7d';
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: tokenExpiry }
        );

        // Сохраняем сессию если нужно запомнить устройство
        if (remember) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            
            await db.query(
                'INSERT INTO user_sessions (user_id, token, device_info, expires_at) VALUES ($1, $2, $3, $4)',
                [user.id, token, req.headers['user-agent'], expiresAt]
            );
        }

        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Ошибка при регистрации' });
    }
});

// Вход
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
], async (req, res) => {
    try {
        // Проверка валидации
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, remember } = req.body;

        // Находим пользователя
        const result = await db.query(
            'SELECT id, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        const user = result.rows[0];

        // Проверяем пароль
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        // Создаем JWT токен
        const tokenExpiry = remember ? '30d' : '7d';
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: tokenExpiry }
        );

        // Сохраняем сессию если нужно запомнить устройство
        if (remember) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            
            await db.query(
                'INSERT INTO user_sessions (user_id, token, device_info, expires_at) VALUES ($1, $2, $3, $4)',
                [user.id, token, req.headers['user-agent'], expiresAt]
            );
        }

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Ошибка при входе' });
    }
});

// Выход
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Получаем токен из заголовка
        const authHeader = req.headers.authorization;
        const token = authHeader.substring(7);

        // Удаляем сессию
        await db.query(
            'DELETE FROM user_sessions WHERE token = $1',
            [token]
        );

        res.json({ message: 'Выход выполнен успешно' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Ошибка при выходе' });
    }
});

// Проверка токена
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        const user = result.rows[0];

        res.json({
            id: user.id,
            email: user.email
        });

    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ message: 'Ошибка проверки токена' });
    }
});

module.exports = router;
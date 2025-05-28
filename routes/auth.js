// routes/auth.js - Маршруты аутентификации
const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Регистрация пользователя
router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, verification_date } = req.body;
    
    // Валидация
    if (!email || !password || !verification_date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    // Проверяем формат email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new AppError('Неверный формат email', 400);
    }
    
    // Проверяем длину пароля
    if (password.length < 6) {
        throw new AppError('Пароль должен быть не менее 6 символов', 400);
    }
    
    // Проверяем, что дата - вчерашняя
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const inputDate = new Date(verification_date);
    inputDate.setHours(0, 0, 0, 0);
    
    if (inputDate.getTime() !== yesterday.getTime()) {
        throw new AppError('Неверная дата верификации', 400);
    }
    
    // Хешируем пароль
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    try {
        // Создаём пользователя
        const result = await query(
            `INSERT INTO users (email, password_hash, verification_date) 
             VALUES ($1, $2, $3) 
             RETURNING id, email, created_at`,
            [email, passwordHash, verification_date]
        );
        
        const user = result.rows[0];
        const token = generateToken(user);
        
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email
            },
            token
        });
    } catch (error) {
        if (error.code === '23505') {
            throw new AppError('Пользователь с таким email уже существует', 409);
        }
        throw error;
    }
}));

// Вход в систему
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password, rememberDevice } = req.body;
    
    // Валидация
    if (!email || !password) {
        throw new AppError('Email и пароль обязательны', 400);
    }
    
    // Ищем пользователя
    const result = await query(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        [email]
    );
    
    if (result.rows.length === 0) {
        throw new AppError('Неверный email или пароль', 401);
    }
    
    const user = result.rows[0];
    
    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        throw new AppError('Неверный email или пароль', 401);
    }
    
    // Генерируем токен
    const token = generateToken(user);
    
    // Обновляем последний вход
    await query(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
    );
    
    res.json({
        user: {
            id: user.id,
            email: user.email
        },
        token
    });
}));

// Выход из системы
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
    // В данной реализации просто возвращаем успех
    // Клиент должен удалить токен
    res.json({ message: 'Выход выполнен успешно' });
}));

// Проверка токена
router.get('/verify', authenticateToken, asyncHandler(async (req, res) => {
    // Получаем актуальные данные пользователя
    const result = await query(
        'SELECT id, email, created_at FROM users WHERE id = $1',
        [req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new AppError('Пользователь не найден', 404);
    }
    
    res.json({
        user: result.rows[0]
    });
}));

module.exports = router;
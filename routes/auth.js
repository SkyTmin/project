const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, verification_date } = req.body;
    
    if (!email || !password || !verification_date) {
        throw new AppError('Все поля обязательны', 400);
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError('Неверный формат email', 400);
    }
    
    if (password.length < 6) {
        throw new AppError('Пароль должен быть не менее 6 символов', 400);
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const inputDate = new Date(verification_date);
    inputDate.setHours(0, 0, 0, 0);
    
    if (inputDate.getTime() !== yesterday.getTime()) {
        throw new AppError('Неверная дата верификации', 400);
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    try {
        const result = await query(
            `INSERT INTO users (email, password_hash, verification_date) 
             VALUES ($1, $2, $3) 
             RETURNING id, email, created_at`,
            [email, passwordHash, verification_date]
        );
        
        const user = result.rows[0];
        const token = generateToken(user);
        
        res.status(201).json({
            user: { id: user.id, email: user.email },
            token
        });
    } catch (error) {
        if (error.code === '23505') {
            throw new AppError('Пользователь с таким email уже существует', 409);
        }
        throw error;
    }
}));

router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        throw new AppError('Email и пароль обязательны', 400);
    }
    
    const result = await query(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        [email]
    );
    
    if (result.rows.length === 0) {
        throw new AppError('Неверный email или пароль', 401);
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
        throw new AppError('Неверный email или пароль', 401);
    }
    
    const token = generateToken(user);
    
    await query(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
    );
    
    res.json({
        user: { id: user.id, email: user.email },
        token
    });
}));

router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
    res.json({ message: 'Выход выполнен успешно' });
}));

router.get('/verify', authenticateToken, asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT id, email, created_at FROM users WHERE id = $1',
        [req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new AppError('Пользователь не найден', 404);
    }
    
    res.json({ user: result.rows[0] });
}));

module.exports = router;

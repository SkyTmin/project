// middleware/auth.js - Middleware для проверки аутентификации
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        
        req.user = user;
        next();
    });
};

// Генерация JWT токена
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email 
        },
        JWT_SECRET,
        { 
            expiresIn: '7d' // Токен действителен 7 дней
        }
    );
};

// Опциональная аутентификация (для публичных эндпоинтов)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    
    next();
};

module.exports = {
    authenticateToken,
    generateToken,
    optionalAuth,
    JWT_SECRET
};
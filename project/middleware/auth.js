// middleware/auth.js - Middleware для проверки JWT токенов
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // Получаем токен из заголовка
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Токен не предоставлен' });
        }

        const token = authHeader.substring(7);

        // Проверяем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Добавляем информацию о пользователе в запрос
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Токен истек' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Недействительный токен' });
        }
        return res.status(500).json({ message: 'Ошибка аутентификации' });
    }
};

module.exports = authMiddleware;
// middleware/errorHandler.js - Централизованная обработка ошибок
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Ошибки валидации
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Ошибка валидации',
            details: err.message
        });
    }
    
    // Ошибки JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Недействительный токен'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Токен истёк'
        });
    }
    
    // Ошибки базы данных
    if (err.code === '23505') { // Unique violation
        return res.status(409).json({
            error: 'Запись уже существует'
        });
    }
    
    if (err.code === '23503') { // Foreign key violation
        return res.status(400).json({
            error: 'Ссылка на несуществующую запись'
        });
    }
    
    // Кастомные ошибки
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            error: err.message
        });
    }
    
    // Ошибка по умолчанию
    res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
};

// Класс для кастомных ошибок
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

// Обёртка для асинхронных функций
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    AppError,
    asyncHandler
};
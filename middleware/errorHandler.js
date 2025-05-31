const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    const errorMap = {
        'ValidationError': { status: 400, message: 'Ошибка валидации' },
        'JsonWebTokenError': { status: 401, message: 'Недействительный токен' },
        'TokenExpiredError': { status: 401, message: 'Токен истёк' },
        '23505': { status: 409, message: 'Запись уже существует' },
        '23503': { status: 400, message: 'Ссылка на несуществующую запись' }
    };
    
    const error = errorMap[err.name] || errorMap[err.code];
    
    if (error) {
        return res.status(error.status).json({ error: error.message });
    }
    
    if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
    }
    
    res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
};

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    AppError,
    asyncHandler
};

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

app.use(compression());
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Добавляем логирование для отладки
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Проверяем наличие файлов маршрутов
try {
    const authRoutes = require('./routes/auth');
    const incomeSheetsRoutes = require('./routes/incomeSheets');
    const expensesRoutes = require('./routes/expenses');
    const debtsRoutes = require('./routes/debts');
    const debtPaymentsRoutes = require('./routes/debtPayments');
    
    app.use('/api/auth', authRoutes);
    app.use('/api/income-sheets', incomeSheetsRoutes);
    app.use('/api/expenses', expensesRoutes);
    app.use('/api/debts', debtsRoutes);
    app.use('/api/debt-payments', debtPaymentsRoutes);
    
    console.log('All routes loaded successfully');
} catch (error) {
    console.error('Error loading routes:', error);
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Тестовый маршрут для проверки долгов
app.get('/api/test-debts', async (req, res) => {
    try {
        const { query } = require('./config/db');
        const result = await query('SELECT 1 as test');
        res.json({ 
            status: 'ok', 
            database: 'connected',
            test: result.rows[0]
        });
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    errorHandler(err, req, res, next);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
});

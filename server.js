const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Создаем директорию для базы данных если не существует
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/database.db'  // Для некоторых хостингов
    : path.join(__dirname, 'database.db');

// Инициализация базы данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('✅ Подключение к SQLite базе данных успешно');
    }
});

// Создание таблиц
db.serialize(() => {
    // Таблица для листов доходов
    db.run(`
        CREATE TABLE IF NOT EXISTS income_sheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица для расходов
    db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sheet_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            note TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sheet_id) REFERENCES income_sheets (id) ON DELETE CASCADE
        )
    `);
    
    // Таблица для истории калькулятора
    db.run(`
        CREATE TABLE IF NOT EXISTS calculator_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            calculation TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ Таблицы базы данных инициализированы');
});

// ===== API для Coco Many =====

// Получить все листы доходов
app.get('/api/sheets', (req, res) => {
    const query = `
        SELECT s.*, 
               COALESCE(SUM(e.amount), 0) as total_expenses,
               (s.amount - COALESCE(SUM(e.amount), 0)) as balance
        FROM income_sheets s
        LEFT JOIN expenses e ON s.id = e.sheet_id
        GROUP BY s.id
        ORDER BY s.created_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка базы данных' });
            return;
        }
        res.json(rows);
    });
});

// Получить лист по ID с расходами
app.get('/api/sheets/:id', (req, res) => {
    const sheetId = req.params.id;
    
    // Получаем лист
    db.get('SELECT * FROM income_sheets WHERE id = ?', [sheetId], (err, sheet) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка базы данных' });
            return;
        }
        
        if (!sheet) {
            res.status(404).json({ error: 'Лист не найден' });
            return;
        }
        
        // Получаем расходы для этого листа
        db.all('SELECT * FROM expenses WHERE sheet_id = ? ORDER BY created_at DESC', 
               [sheetId], (err, expenses) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Ошибка базы данных' });
                return;
            }
            
            res.json({
                ...sheet,
                expenses: expenses || []
            });
        });
    });
});

// Создать новый лист доходов
app.post('/api/sheets', (req, res) => {
    const { name, amount, date } = req.body;
    
    if (!name || !amount || !date) {
        res.status(400).json({ error: 'Заполните все поля' });
        return;
    }
    
    const query = 'INSERT INTO income_sheets (name, amount, date) VALUES (?, ?, ?)';
    db.run(query, [name, amount, date], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка создания листа' });
            return;
        }
        
        res.json({ id: this.lastID, name, amount, date });
    });
});

// Обновить лист доходов
app.put('/api/sheets/:id', (req, res) => {
    const { name, amount, date } = req.body;
    const sheetId = req.params.id;
    
    const query = 'UPDATE income_sheets SET name = ?, amount = ?, date = ? WHERE id = ?';
    db.run(query, [name, amount, date, sheetId], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка обновления листа' });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Лист не найден' });
            return;
        }
        
        res.json({ success: true });
    });
});

// Удалить лист доходов
app.delete('/api/sheets/:id', (req, res) => {
    const sheetId = req.params.id;
    
    // Сначала удаляем все расходы
    db.run('DELETE FROM expenses WHERE sheet_id = ?', [sheetId], (err) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка удаления расходов' });
            return;
        }
        
        // Затем удаляем сам лист
        db.run('DELETE FROM income_sheets WHERE id = ?', [sheetId], function(err) {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Ошибка удаления листа' });
                return;
            }
            
            if (this.changes === 0) {
                res.status(404).json({ error: 'Лист не найден' });
                return;
            }
            
            res.json({ success: true });
        });
    });
});

// ===== API для расходов =====

// Добавить расход
app.post('/api/expenses', (req, res) => {
    const { sheet_id, amount, note } = req.body;
    
    if (!sheet_id || !amount || !note) {
        res.status(400).json({ error: 'Заполните все поля' });
        return;
    }
    
    const query = 'INSERT INTO expenses (sheet_id, amount, note) VALUES (?, ?, ?)';
    db.run(query, [sheet_id, amount, note], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка добавления расхода' });
            return;
        }
        
        res.json({ id: this.lastID, sheet_id, amount, note });
    });
});

// Обновить расход
app.put('/api/expenses/:id', (req, res) => {
    const { amount, note } = req.body;
    const expenseId = req.params.id;
    
    const query = 'UPDATE expenses SET amount = ?, note = ? WHERE id = ?';
    db.run(query, [amount, note, expenseId], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка обновления расхода' });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Расход не найден' });
            return;
        }
        
        res.json({ success: true });
    });
});

// Удалить расход
app.delete('/api/expenses/:id', (req, res) => {
    const expenseId = req.params.id;
    
    db.run('DELETE FROM expenses WHERE id = ?', [expenseId], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка удаления расхода' });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Расход не найден' });
            return;
        }
        
        res.json({ success: true });
    });
});

// ===== API для калькулятора =====

// Получить историю калькулятора
app.get('/api/calculator/history', (req, res) => {
    db.all('SELECT * FROM calculator_history ORDER BY created_at DESC LIMIT 10', 
           [], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка базы данных' });
            return;
        }
        res.json(rows.map(row => row.calculation));
    });
});

// Добавить в историю калькулятора
app.post('/api/calculator/history', (req, res) => {
    const { calculation } = req.body;
    
    if (!calculation) {
        res.status(400).json({ error: 'Не указан расчет' });
        return;
    }
    
    // Проверяем, нет ли уже такого расчета
    db.get('SELECT id FROM calculator_history WHERE calculation = ?', 
           [calculation], (err, row) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка базы данных' });
            return;
        }
        
        if (row) {
            // Если есть, просто возвращаем успех
            res.json({ success: true });
            return;
        }
        
        // Если нет, добавляем
        db.run('INSERT INTO calculator_history (calculation) VALUES (?)', 
               [calculation], function(err) {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Ошибка добавления в историю' });
                return;
            }
            
            res.json({ success: true });
        });
    });
});

// Очистить историю калькулятора
app.delete('/api/calculator/history', (req, res) => {
    db.run('DELETE FROM calculator_history', [], function(err) {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Ошибка очистки истории' });
            return;
        }
        
        res.json({ success: true });
    });
});

// Health check для хостинга
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 обработчик
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Откройте http://localhost:${PORT}`);
    console.log(`🗄️ База данных: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Закрытие сервера...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка закрытия базы данных:', err.message);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM получен, закрытие сервера...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка закрытия базы данных:', err.message);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});
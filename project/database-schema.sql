-- database-schema.sql - Схема базы данных для Coco Instrument

-- Создание базы данных
CREATE DATABASE coco_instrument;

-- Подключение к базе данных
\c coco_instrument;

-- Таблица пользователей
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    verification_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сессий (для запоминания устройств)
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    device_info TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица листов доходов
CREATE TABLE income_sheets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    income_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица расходов
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    income_sheet_id INTEGER REFERENCES income_sheets(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_income_sheets_user_id ON income_sheets(user_id);
CREATE INDEX idx_income_sheets_date ON income_sheets(date);
CREATE INDEX idx_expenses_income_sheet_id ON expenses(income_sheet_id);
CREATE INDEX idx_expenses_created_at ON expenses(created_at);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_income_sheets_updated_at BEFORE UPDATE ON income_sheets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Представление для статистики пользователя
CREATE VIEW user_statistics AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT is.id) as total_sheets,
    COALESCE(SUM(is.income_amount), 0) as total_income,
    COALESCE(SUM(e.total_expenses), 0) as total_expenses,
    COALESCE(SUM(is.income_amount) - SUM(e.total_expenses), 0) as total_balance
FROM users u
LEFT JOIN income_sheets is ON u.id = is.user_id
LEFT JOIN (
    SELECT income_sheet_id, SUM(amount) as total_expenses
    FROM expenses
    GROUP BY income_sheet_id
) e ON is.id = e.income_sheet_id
GROUP BY u.id, u.email;

-- Функция для получения баланса листа
CREATE OR REPLACE FUNCTION get_sheet_balance(sheet_id INTEGER)
RETURNS DECIMAL AS $$
DECLARE
    income DECIMAL;
    expenses DECIMAL;
BEGIN
    SELECT income_amount INTO income FROM income_sheets WHERE id = sheet_id;
    SELECT COALESCE(SUM(amount), 0) INTO expenses FROM expenses WHERE income_sheet_id = sheet_id;
    RETURN income - expenses;
END;
$$ LANGUAGE plpgsql;

-- Примеры запросов для API

-- Получить все листы пользователя с балансом
/*
SELECT 
    is.*,
    COALESCE(SUM(e.amount), 0) as total_expenses,
    is.income_amount - COALESCE(SUM(e.amount), 0) as balance
FROM income_sheets is
LEFT JOIN expenses e ON is.id = e.income_sheet_id
WHERE is.user_id = $1
GROUP BY is.id
ORDER BY is.date DESC;
*/

-- Получить расходы листа
/*
SELECT * FROM expenses 
WHERE income_sheet_id = $1 
ORDER BY created_at DESC;
*/
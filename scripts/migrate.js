// scripts/migrate.js - Скрипт создания таблиц в базе данных
const { query, pool } = require('../config/db');
require('dotenv').config();

async function migrate() {
    console.log('Starting database migration...');
    
    try {
        // Создаём таблицу пользователей
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                verification_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Users table created');
        
        // Создаём таблицу листов доходов
        await query(`
            CREATE TABLE IF NOT EXISTS income_sheets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                income_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                date DATE NOT NULL,
                exclude_from_balance BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Income sheets table created');
        
        // Создаём таблицу расходов
        await query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                income_sheet_id INTEGER REFERENCES income_sheets(id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL,
                note TEXT,
                is_preliminary BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Expenses table created');
        
        // Создаём индексы для оптимизации
        await query(`
            CREATE INDEX IF NOT EXISTS idx_income_sheets_user_id 
            ON income_sheets(user_id)
        `);
        console.log('✓ Index on income_sheets.user_id created');
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_expenses_income_sheet_id 
            ON expenses(income_sheet_id)
        `);
        console.log('✓ Index on expenses.income_sheet_id created');
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_users_email 
            ON users(email)
        `);
        console.log('✓ Index on users.email created');
        
        // Создаём функцию для автоматического обновления updated_at
        await query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE 'plpgsql';
        `);
        console.log('✓ Update timestamp function created');
        
        // Триггер для users
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
                    CREATE TRIGGER update_users_updated_at 
                    BEFORE UPDATE ON users 
                    FOR EACH ROW 
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END
            $$;
        `);
        console.log('✓ Trigger for users.updated_at created');

        // Триггер для income_sheets
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_income_sheets_updated_at') THEN
                    CREATE TRIGGER update_income_sheets_updated_at 
                    BEFORE UPDATE ON income_sheets 
                    FOR EACH ROW 
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END
            $$;
        `);
        console.log('✓ Trigger for income_sheets.updated_at created');

        // Триггер для expenses
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_expenses_updated_at') THEN
                    CREATE TRIGGER update_expenses_updated_at 
                    BEFORE UPDATE ON expenses 
                    FOR EACH ROW 
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END
            $$;
        `);
        console.log('✓ Trigger for expenses.updated_at created');
        
        // Добавляем exclude_from_balance при необходимости
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name = 'income_sheets' 
                              AND column_name = 'exclude_from_balance') THEN
                    ALTER TABLE income_sheets ADD COLUMN exclude_from_balance BOOLEAN DEFAULT FALSE;
                END IF;
            END
            $$;
        `);
        console.log('✓ Added exclude_from_balance column to income_sheets if not exists');
        
        // Добавляем is_preliminary при необходимости
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name = 'expenses' 
                              AND column_name = 'is_preliminary') THEN
                    ALTER TABLE expenses ADD COLUMN is_preliminary BOOLEAN DEFAULT FALSE;
                END IF;
            END
            $$;
        `);
        console.log('✓ Added is_preliminary column to expenses if not exists');
        
        console.log('\n✅ Database migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Запускаем миграцию
migrate();

const { query, pool } = require('../config/db');
require('dotenv').config();

async function migrate() {
    console.log('Starting database migration...');
    
    try {
        // Создаем таблицу пользователей
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
        
        // Создаем таблицу листов доходов
        await query(`
            CREATE TABLE IF NOT EXISTS income_sheets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                income_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                date DATE NOT NULL,
                exclude_from_balance BOOLEAN DEFAULT FALSE,
                is_preliminary BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Income sheets table created');
        
        // Создаем таблицу расходов
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
        
        // Создаем таблицу долгов
        await query(`
            CREATE TABLE IF NOT EXISTS debts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                creditor VARCHAR(255) NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                due_date DATE NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Debts table created');
        
        // Создаем таблицу платежей по долгам
        await query(`
            CREATE TABLE IF NOT EXISTS debt_payments (
                id SERIAL PRIMARY KEY,
                debt_id INTEGER REFERENCES debts(id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL,
                payment_date DATE NOT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Debt payments table created');
        
        // Создаем индексы
        await query(`CREATE INDEX IF NOT EXISTS idx_income_sheets_user_id ON income_sheets(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_expenses_income_sheet_id ON expenses(income_sheet_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id)`);
        console.log('✓ Indexes created');
        
        // Создаем функцию для обновления timestamp
        await query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('✓ Update timestamp function created');
        
        // Создаем триггеры для каждой таблицы
        const triggers = [
            { table: 'users', name: 'update_users_updated_at' },
            { table: 'income_sheets', name: 'update_income_sheets_updated_at' },
            { table: 'expenses', name: 'update_expenses_updated_at' },
            { table: 'debts', name: 'update_debts_updated_at' },
            { table: 'debt_payments', name: 'update_debt_payments_updated_at' }
        ];
        
        for (const { table, name } of triggers) {
            await query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '${name}') THEN
                        CREATE TRIGGER ${name} 
                        BEFORE UPDATE ON ${table} 
                        FOR EACH ROW 
                        EXECUTE FUNCTION update_updated_at_column();
                    END IF;
                END $$;
            `);
        }
        console.log('✓ Triggers created');
        
        // Добавляем дополнительные колонки, если их нет
        const columns = [
            { table: 'income_sheets', column: 'exclude_from_balance', type: 'BOOLEAN DEFAULT FALSE' },
            { table: 'income_sheets', column: 'is_preliminary', type: 'BOOLEAN DEFAULT FALSE' },
            { table: 'expenses', column: 'is_preliminary', type: 'BOOLEAN DEFAULT FALSE' }
        ];
        
        for (const { table, column, type } of columns) {
            await query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = '${table}' AND column_name = '${column}'
                    ) THEN
                        ALTER TABLE ${table} ADD COLUMN ${column} ${type};
                    END IF;
                END $$;
            `);
        }
        console.log('✓ Additional columns added if not exist');
        
        console.log('\n✅ Database migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('Error details:', error.message);
        if (error.query) {
            console.error('Failed query:', error.query);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();

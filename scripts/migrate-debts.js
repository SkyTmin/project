const { query } = require('../config/db');

async function migrateDebts() {
    console.log('Adding debts tables...');
    
    try {
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
        
        await query(`CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id)`);
        console.log('✓ Indexes created');
        
        await query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        const triggers = [
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
        
        console.log('\n✅ Debts migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Debts migration failed:', error);
        throw error;
    }
}

module.exports = { migrateDebts };

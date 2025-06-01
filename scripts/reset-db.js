const { query, pool } = require('../config/db');
require('dotenv').config();

async function resetDatabase() {
    console.log('Resetting database...');
    
    try {
        // Удаляем таблицы в правильном порядке (из-за foreign keys)
        console.log('Dropping existing tables...');
        
        await query('DROP TABLE IF EXISTS debt_payments CASCADE');
        await query('DROP TABLE IF EXISTS debts CASCADE');
        await query('DROP TABLE IF EXISTS expenses CASCADE');
        await query('DROP TABLE IF EXISTS income_sheets CASCADE');
        await query('DROP TABLE IF EXISTS users CASCADE');
        
        console.log('✓ All tables dropped');
        
        // Удаляем функцию, если она существует
        await query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
        console.log('✓ Functions dropped');
        
        console.log('\nDatabase reset complete. Run migration to recreate tables.');
        
    } catch (error) {
        console.error('❌ Reset failed:', error);
        console.error('Error details:', error.message);
    } finally {
        await pool.end();
    }
}

resetDatabase();

// config/db.js - Конфигурация базы данных PostgreSQL
const { Pool } = require('pg');

// Создаем пул соединений
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
    max: 20, // максимум соединений в пуле
    idleTimeoutMillis: 30000, // время ожидания перед закрытием неиспользуемого соединения
    connectionTimeoutMillis: 2000, // время ожидания при подключении
});

// Обработка ошибок пула
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// Функция для выполнения запросов
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Функция для получения клиента (для транзакций)
const getClient = async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;
    
    // Устанавливаем timeout для релиза клиента
    const timeout = setTimeout(() => {
        console.error('A client has been checked out for more than 5 seconds!');
        console.error(`The last executed query on this client was: ${client.lastQuery}`);
    }, 5000);
    
    // Переопределяем методы для логирования
    client.query = (...args) => {
        client.lastQuery = args;
        return query.apply(client, args);
    };
    
    client.release = () => {
        clearTimeout(timeout);
        client.query = query;
        client.release = release;
        return release.apply(client);
    };
    
    return client;
};

module.exports = {
    query,
    getClient,
    pool
};
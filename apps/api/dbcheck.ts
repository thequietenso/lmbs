import { Pool } from 'pg';

const conn = process.env.DATABASE_URL || '';
console.log('Connection string:', conn.substring(0, conn.indexOf('@')) + '***@***');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT NOW() AS now', (err, res) => {
  if (err) {
    console.error('❌ DB error:', err.message);
    console.error('Details:', err);
  } else {
    console.log('✅ DB connected. Now:', res.rows[0].now);
  }
  pool.end();
});

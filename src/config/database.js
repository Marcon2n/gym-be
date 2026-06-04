const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME, // Lúc này sẽ nhận giá trị là 'postgres'
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// ÉP NODE.JS LUÔN LUÔN SỬ DỤNG SCHEMA GYM_MANAGEMENT
pool.on('connect', (client) => {
  client.query('SET search_path TO gym_management, public');
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Lỗi kết nối PostgreSQL:', err);
  } else {
    console.log('✅ Kết nối PostgreSQL thành công vào schema gym_management!');
  }
});

module.exports = pool;
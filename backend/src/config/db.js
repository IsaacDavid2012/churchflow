const { Pool, types } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Force DATE columns (OID 1082) to parse as string 'YYYY-MM-DD' instead of UTC Date object
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'servesync',
  password: process.env.DB_PASSWORD || 'servesync_secret',
  database: process.env.DB_NAME || 'servesync',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};

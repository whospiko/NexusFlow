import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pkg;

// Resolve PostgreSQL configuration with DB_USER and USER_PASSWORD support
const user = process.env.DB_USER || process.env.PGUSER;
const password = process.env.USER_PASSWORD ?? process.env.DB_PASSWORD ?? process.env.PGPASSWORD;
const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
const port = Number(process.env.DB_PORT || process.env.PGPORT || 5432);
const database = process.env.DB_NAME || process.env.DATABASE_NAME || process.env.PGDATABASE || 'bug_tracker';
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;

let poolConfig;

if (user) {
  poolConfig = {
    user,
    password: password !== undefined ? String(password) : undefined,
    host,
    port,
    database,
    ssl,
  };
  // Automatically provide backward-compatible process.env.DATABASE_URL if not already present
  if (!process.env.DATABASE_URL) {
    const encodedUser = encodeURIComponent(user);
    const encodedPass = password !== undefined ? `:${encodeURIComponent(password)}` : '';
    process.env.DATABASE_URL = `postgres://${encodedUser}${encodedPass}@${host}:${port}/${database}`;
  }
} else if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl,
  };
} else {
  poolConfig = {
    connectionString: 'postgres://piko:ruppcsd2025@localhost:5432/bug_tracker',
    ssl,
  };
}

// Initialize PostgreSQL Connection Pool
export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  // connection acquired
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);


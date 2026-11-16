import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_rupp2025_piko_pisey';
const JWT_EXPIRES_IN = '7d';

/**
 * Sign a JSON Web Token for an authenticated user
 */
export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify a JSON Web Token
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Find or create a user by email and OAuth profile
 */
export async function findOrCreateUser({ email, name, avatarUrl, provider = 'local', providerId = null, isDemo = false }) {
  const cleanEmail = email.toLowerCase().trim();

  // Check if user already exists
  const checkSql = 'SELECT * FROM users WHERE email = $1 LIMIT 1;';
  const existing = await query(checkSql, [cleanEmail]);

  if (existing.rows.length > 0) {
    const user = existing.rows[0];

    // CRITICAL SECURITY: Never allow 'local' dev login to overwrite real OAuth provider ('google', 'github')!
    let targetProvider = user.provider;
    if (provider && provider !== 'local') {
      targetProvider = provider;
    }

    let targetProviderId = user.provider_id;
    if (providerId) {
      targetProviderId = providerId;
    }

    // Determine is_demo: True ONLY for seed demo accounts or explicit company.com demo accounts
    const isCompanyDemo = cleanEmail.endsWith('@company.com') || user.id <= 6;
    const targetIsDemo = isCompanyDemo && targetProvider === 'local';

    // Update avatar or provider info if provided
    const updateSql = `
      UPDATE users 
      SET 
        name = COALESCE($1, name),
        avatar_url = COALESCE($2, avatar_url),
        provider = $3,
        provider_id = $4,
        is_demo = $5
      WHERE id = $6
      RETURNING *;
    `;
    const updated = await query(updateSql, [
      name || user.name,
      avatarUrl || user.avatar_url,
      targetProvider,
      targetProviderId,
      targetIsDemo,
      user.id,
    ]);
    return updated.rows[0];
  }

  // Insert fresh user
  const isCompanyDemo = cleanEmail.endsWith('@company.com');
  const isDemoUser = (isDemo || isCompanyDemo) && provider === 'local';

  const insertSql = `
    INSERT INTO users (email, name, avatar_url, provider, provider_id, is_demo)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const defaultAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || cleanEmail)}`;
  const inserted = await query(insertSql, [
    cleanEmail,
    name || cleanEmail.split('@')[0],
    defaultAvatar,
    provider,
    providerId,
    isDemoUser,
  ]);
  return inserted.rows[0];
}

/**
 * Retrieve user by ID
 */
export async function getUserById(id) {
  const sql = 'SELECT id, email, name, avatar_url, provider, is_demo, created_at FROM users WHERE id = $1;';
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

/**
 * Retrieve user by Email
 */
export async function getUserByEmail(email) {
  if (!email) return null;
  const sql = 'SELECT id, email, name, avatar_url, provider, is_demo, created_at FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1;';
  const res = await query(sql, [email]);
  return res.rows[0] || null;
}

/**
 * List only designated demo users for the 1-Click test UI
 * Strictly excludes real OAuth accounts (Google, GitHub, etc.)
 */
export async function getDemoUsers() {
  const sql = `
    SELECT id, email, name, avatar_url, provider, is_demo, created_at 
    FROM users 
    WHERE (is_demo = TRUE OR (provider = 'local' AND email LIKE '%@company.com'))
      AND provider NOT IN ('google', 'github')
      AND email NOT LIKE '%@gmail.com'
    ORDER BY id ASC;
  `;
  const res = await query(sql);
  return res.rows;
}

/**
 * List all users (internal administrative use only)
 */
export async function getAllUsers() {
  const sql = 'SELECT id, email, name, avatar_url, provider, is_demo, created_at FROM users ORDER BY id ASC;';
  const res = await query(sql);
  return res.rows;
}

/**
 * Idempotently ensure auth and multi-tenancy tables exist
 */
export async function ensureAuthTablesExist() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        avatar_url TEXT,
        provider VARCHAR(50) NOT NULL DEFAULT 'local',
        provider_id VARCHAR(255),
        is_demo BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

      -- Mark initial seed users as demo
      UPDATE users SET is_demo = TRUE WHERE email LIKE '%@company.com' OR id <= 6;
      -- Strictly ensure OAuth accounts are NOT demo
      UPDATE users SET is_demo = FALSE WHERE provider IN ('google', 'github') OR (email NOT LIKE '%@company.com' AND id > 6);
      -- If previous devLogin erroneously set provider to 'local' for real gmail accounts, restore to google
      UPDATE users SET provider = 'google' WHERE email LIKE '%@gmail.com' AND provider = 'local' AND id > 6;

      CREATE TABLE IF NOT EXISTS project_members (
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS project_invitations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        token VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_is_demo ON users(is_demo);
      CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);
    `;
    await query(sql);
  } catch (err) {
    console.error('⚠️ Notice in ensureAuthTablesExist:', err.message);
  }
}


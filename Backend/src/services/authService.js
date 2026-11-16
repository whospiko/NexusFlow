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
export async function findOrCreateUser({ email, name, avatarUrl, provider = 'local', providerId = null }) {
  // Check if user already exists
  const checkSql = 'SELECT * FROM users WHERE email = $1 LIMIT 1;';
  const existing = await query(checkSql, [email.toLowerCase().trim()]);

  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    // Update avatar or provider info if provided
    const updateSql = `
      UPDATE users 
      SET 
        name = COALESCE($1, name),
        avatar_url = COALESCE($2, avatar_url),
        provider = COALESCE($3, provider),
        provider_id = COALESCE($4, provider_id)
      WHERE id = $5
      RETURNING *;
    `;
    const updated = await query(updateSql, [
      name || user.name,
      avatarUrl || user.avatar_url,
      provider || user.provider,
      providerId || user.provider_id,
      user.id,
    ]);
    return updated.rows[0];
  }

  // Insert fresh user
  const insertSql = `
    INSERT INTO users (email, name, avatar_url, provider, provider_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const defaultAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || email)}`;
  const inserted = await query(insertSql, [
    email.toLowerCase().trim(),
    name || email.split('@')[0],
    defaultAvatar,
    provider,
    providerId,
  ]);
  return inserted.rows[0];
}

/**
 * Retrieve user by ID
 */
export async function getUserById(id) {
  const sql = 'SELECT id, email, name, avatar_url, provider, created_at FROM users WHERE id = $1;';
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

/**
 * List all users (useful for dev login and team selection)
 */
export async function getAllUsers() {
  const sql = 'SELECT id, email, name, avatar_url, provider, created_at FROM users ORDER BY id ASC;';
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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
      CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);
    `;
    await query(sql);
  } catch (err) {
    console.error('⚠️ Notice in ensureAuthTablesExist:', err.message);
  }
}


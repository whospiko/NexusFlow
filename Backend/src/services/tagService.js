import { query } from '../config/db.js';
import { logActivity } from './activityService.js';

/**
 * Ensures tags and task_tags junction table exist automatically on boot
 */
export async function ensureTagTablesExist() {
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        color VARCHAR(25) NOT NULL DEFAULT '#6366f1'
      );

      CREATE TABLE IF NOT EXISTS task_tags (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (task_id, tag_id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);
      CREATE OR REPLACE VIEW issue_tags AS SELECT task_id AS issue_id, tag_id, created_at FROM task_tags;

      INSERT INTO tags (name, color) VALUES
        ('backend', '#6366f1'),
        ('frontend', '#06b6d4'),
        ('security', '#f43f5e'),
        ('database', '#10b981'),
        ('performance', '#f59e0b'),
        ('bug', '#ef4444'),
        ('network', '#8b5cf6')
      ON CONFLICT (name) DO NOTHING;
    `;
    await query(ddl);
  } catch (err) {
    console.warn('Tag tables migration check skipped:', err.message);
  }
}

/**
 * Fetch all available tags
 */
export async function getAllTags() {
  const sql = `SELECT id, name, color FROM tags ORDER BY name ASC;`;
  const result = await query(sql);
  return result.rows;
}

/**
 * Create or retrieve an existing tag
 */
export async function createTag(name, color = '#6366f1') {
  const cleanName = name.trim().toLowerCase();
  const sql = `
    INSERT INTO tags (name, color)
    VALUES ($1, $2)
    ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
    RETURNING *;
  `;
  const result = await query(sql, [cleanName, color]);
  return result.rows[0];
}

/**
 * Fetch all tags linked to a specific task
 */
export async function getTagsForTask(taskId) {
  const sql = `
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN task_tags tt ON t.id = tt.tag_id
    WHERE tt.task_id = $1
    ORDER BY t.name ASC;
  `;
  const result = await query(sql, [taskId]);
  return result.rows;
}

export const getTagsForIssue = getTagsForTask;

/**
 * Attach a tag to a task (Many-to-Many association) and log audit event
 */
export async function attachTagToTask(taskId, tagId, actor = 'Piko') {
  const sql = `
    INSERT INTO task_tags (task_id, tag_id)
    VALUES ($1, $2)
    ON CONFLICT (task_id, tag_id) DO NOTHING
    RETURNING *;
  `;
  const result = await query(sql, [taskId, tagId]);

  // Fetch tag details for audit logging
  const tagRes = await query(`SELECT name FROM tags WHERE id = $1`, [tagId]);
  const tagName = tagRes.rows[0]?.name || `tag #${tagId}`;

  if (result.rows.length > 0) {
    await logActivity({
      taskId,
      actor,
      actionType: 'tag_added',
      fieldName: 'tags',
      newValue: tagName,
    });
  }

  return getTagsForTask(taskId);
}

export const attachTagToIssue = attachTagToTask;

/**
 * Remove a tag from a task and log audit event
 */
export async function removeTagFromTask(taskId, tagId, actor = 'Piko') {
  const tagRes = await query(`SELECT name FROM tags WHERE id = $1`, [tagId]);
  const tagName = tagRes.rows[0]?.name || `tag #${tagId}`;

  const sql = `
    DELETE FROM task_tags
    WHERE task_id = $1 AND tag_id = $2
    RETURNING *;
  `;
  const result = await query(sql, [taskId, tagId]);

  if (result.rows.length > 0) {
    await logActivity({
      taskId,
      actor,
      actionType: 'tag_removed',
      fieldName: 'tags',
      oldValue: tagName,
    });
  }

  return getTagsForTask(taskId);
}

export const removeTagFromIssue = removeTagFromTask;

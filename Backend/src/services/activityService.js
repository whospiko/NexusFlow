import { query } from '../config/db.js';

/**
 * Ensures the task_activities audit table and index exist automatically
 */
export async function ensureActivityTableExists() {
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS task_activities (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        actor VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(50),
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id);
      CREATE OR REPLACE VIEW issue_activities AS SELECT id, task_id AS issue_id, actor, action_type, field_name, old_value, new_value, created_at FROM task_activities;
    `;
    await query(ddl);
  } catch (err) {
    console.warn('Activity table migration check skipped:', err.message);
  }
}

/**
 * Log an audit trail entry for a task
 * @param {object} params
 * @param {number} [params.taskId]
 * @param {number} [params.issueId]
 * @param {string} params.actor
 * @param {string} params.actionType
 * @param {string} [params.fieldName]
 * @param {string} [params.oldValue]
 * @param {string} [params.newValue]
 * @param {Function} [params.executor]
 */
export async function logActivity({
  taskId,
  issueId,
  actor = 'System',
  actionType,
  fieldName = null,
  oldValue = null,
  newValue = null,
  executor = query,
}) {
  try {
    const id = taskId || issueId;
    const sql = `
      INSERT INTO task_activities (task_id, actor, action_type, field_name, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await executor(sql, [
      id,
      actor.trim(),
      actionType,
      fieldName,
      oldValue,
      newValue,
    ]);
    return res.rows[0];
  } catch (err) {
    console.error('Failed to write activity audit log:', err.message);
    return null;
  }
}

/**
 * Fetch all activity audit events for a task ordered newest first
 */
export async function getActivitiesByTask(taskId) {
  const sql = `
    SELECT 
      id,
      task_id,
      task_id AS issue_id,
      actor,
      action_type,
      field_name,
      old_value,
      new_value,
      created_at
    FROM task_activities
    WHERE task_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await query(sql, [taskId]);
  return result.rows;
}

export const getActivitiesByIssue = getActivitiesByTask;

import { query } from '../config/db.js';

/**
 * Auto-migration: Ensure task_dependencies table exists on startup
 */
export async function ensureDependencyTableExists() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        successor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL DEFAULT 'FS' CHECK (type IN ('FS', 'SS', 'FF', 'SF')),
        lag_days INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_no_self_dependency CHECK (predecessor_id <> successor_id),
        CONSTRAINT uq_pred_succ UNIQUE (predecessor_id, successor_id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_deps_project_id ON task_dependencies(project_id);
      CREATE INDEX IF NOT EXISTS idx_task_deps_predecessor ON task_dependencies(predecessor_id);
      CREATE INDEX IF NOT EXISTS idx_task_deps_successor ON task_dependencies(successor_id);
      CREATE OR REPLACE VIEW issue_dependencies AS SELECT * FROM task_dependencies;
    `);
    console.log('✅ task_dependencies table & indexes verified');
  } catch (err) {
    console.error('⚠️ Could not verify task_dependencies table:', err.message);
  }
}

/**
 * Cycle Detection using PostgreSQL Recursive Common Table Expression (CTE)
 * Checks if path exists from successorId to predecessorId.
 * If yes, adding predecessor -> successor would form an illegal cycle.
 */
export async function detectCycle(predecessorId, successorId) {
  if (predecessorId === successorId) return true;

  const sql = `
    WITH RECURSIVE dep_path AS (
      -- Base step: direct successors of the candidate successor
      SELECT successor_id
      FROM task_dependencies
      WHERE predecessor_id = $1

      UNION

      -- Recursive step: follow downstream dependencies
      SELECT d.successor_id
      FROM task_dependencies d
      JOIN dep_path p ON d.predecessor_id = p.successor_id
    )
    SELECT 1 AS cycle_detected
    FROM dep_path
    WHERE successor_id = $2
    LIMIT 1;
  `;

  const result = await query(sql, [successorId, predecessorId]);
  return result.rows.length > 0;
}

/**
 * Evaluates ITPM Precedence Schedule Compliance (FS, SS, FF, SF)
 */
export function evaluateDependencyCompliance(predStartDate, predDueDate, succStartDate, succDueDate, type, lagDays = 0) {
  if (!predStartDate || !predDueDate || !succStartDate || !succDueDate) {
    return { isConflict: false, reason: 'Dates not fully defined', diffDays: 0 };
  }

  const pStart = new Date(predStartDate);
  const pDue = new Date(predDueDate);
  const sStart = new Date(succStartDate);
  const sDue = new Date(succDueDate);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  let isConflict = false;
  let reason = '';
  let diffDays = 0;

  switch (type) {
    case 'FS': {
      // Finish-to-Start: Successor start must be on or after Predecessor due date + lag
      const minStart = new Date(pDue.getTime() + lagDays * MS_PER_DAY);
      diffDays = Math.round((sStart - minStart) / MS_PER_DAY);
      if (sStart < minStart) {
        isConflict = true;
        reason = `Finish-to-Start conflict: Successor starts ${Math.abs(diffDays)} day(s) before predecessor finishes (required lag: ${lagDays}d).`;
      }
      break;
    }
    case 'SS': {
      // Start-to-Start: Successor start must be on or after Predecessor start date + lag
      const minStart = new Date(pStart.getTime() + lagDays * MS_PER_DAY);
      diffDays = Math.round((sStart - minStart) / MS_PER_DAY);
      if (sStart < minStart) {
        isConflict = true;
        reason = `Start-to-Start conflict: Successor starts ${Math.abs(diffDays)} day(s) before predecessor starts (required lag: ${lagDays}d).`;
      }
      break;
    }
    case 'FF': {
      // Finish-to-Finish: Successor due date must be on or after Predecessor due date + lag
      const minDue = new Date(pDue.getTime() + lagDays * MS_PER_DAY);
      diffDays = Math.round((sDue - minDue) / MS_PER_DAY);
      if (sDue < minDue) {
        isConflict = true;
        reason = `Finish-to-Finish conflict: Successor finishes ${Math.abs(diffDays)} day(s) before predecessor finishes (required lag: ${lagDays}d).`;
      }
      break;
    }
    case 'SF': {
      // Start-to-Finish: Successor due date must be on or after Predecessor start date + lag
      const minDue = new Date(pStart.getTime() + lagDays * MS_PER_DAY);
      diffDays = Math.round((sDue - minDue) / MS_PER_DAY);
      if (sDue < minDue) {
        isConflict = true;
        reason = `Start-to-Finish conflict: Successor finishes ${Math.abs(diffDays)} day(s) before predecessor starts (required lag: ${lagDays}d).`;
      }
      break;
    }
    default:
      break;
  }

  return { isConflict, reason, diffDays };
}

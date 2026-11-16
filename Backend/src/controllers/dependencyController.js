import { query } from '../config/db.js';
import { logActivity } from '../services/activityService.js';
import { detectCycle, evaluateDependencyCompliance } from '../services/dependencyService.js';

/**
 * GET /api/projects/:projectId/dependencies
 * Retrieves all ITPM task dependency links for a given project
 */
export async function getProjectDependencies(req, res, next) {
  try {
    const { projectId } = req.params;

    const sql = `
      SELECT 
        d.id,
        d.project_id,
        d.predecessor_id,
        d.successor_id,
        d.type,
        d.lag_days,
        d.created_at,
        p_task.title AS predecessor_title,
        p_task.status AS predecessor_status,
        p_task.priority AS predecessor_priority,
        p_task.assignee AS predecessor_assignee,
        TO_CHAR(COALESCE(p_task.start_date, CURRENT_DATE), 'YYYY-MM-DD') AS predecessor_start_date,
        TO_CHAR(COALESCE(p_task.due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS predecessor_due_date,
        s_task.title AS successor_title,
        s_task.status AS successor_status,
        s_task.priority AS successor_priority,
        s_task.assignee AS successor_assignee,
        TO_CHAR(COALESCE(s_task.start_date, CURRENT_DATE), 'YYYY-MM-DD') AS successor_start_date,
        TO_CHAR(COALESCE(s_task.due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS successor_due_date
      FROM task_dependencies d
      JOIN tasks p_task ON d.predecessor_id = p_task.id
      JOIN tasks s_task ON d.successor_id = s_task.id
      WHERE d.project_id = $1
      ORDER BY d.id ASC;
    `;

    const result = await query(sql, [projectId]);

    const enriched = result.rows.map((row) => {
      const compliance = evaluateDependencyCompliance(
        row.predecessor_start_date,
        row.predecessor_due_date,
        row.successor_start_date,
        row.successor_due_date,
        row.type,
        row.lag_days
      );
      return {
        ...row,
        is_conflict: compliance.isConflict,
        conflict_reason: compliance.reason,
        slack_days: compliance.diffDays,
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/dependencies
 * Creates a new ITPM dependency relationship between two tasks
 */
export async function createDependency(req, res, next) {
  try {
    const { projectId } = req.params;
    const { predecessor_id, successor_id, type = 'FS', lag_days = 0, actor = 'User' } = req.body;

    const predId = parseInt(predecessor_id, 10);
    const succId = parseInt(successor_id, 10);
    const lag = parseInt(lag_days, 10) || 0;

    if (!predId || !succId) {
      return res.status(400).json({
        success: false,
        message: 'Both predecessor_id and successor_id are required integers.',
      });
    }

    if (predId === succId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a self-dependency. A task cannot depend on itself.',
      });
    }

    const validTypes = ['FS', 'SS', 'FF', 'SF'];
    const normType = type.toUpperCase();
    if (!validTypes.includes(normType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid dependency type '${type}'. Must be one of: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish).`,
      });
    }

    // Verify both tasks exist and belong to the project
    const tasksCheck = await query(
      `SELECT id, title, project_id, 
              TO_CHAR(COALESCE(start_date, CURRENT_DATE), 'YYYY-MM-DD') AS start_date, 
              TO_CHAR(COALESCE(due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS due_date 
       FROM tasks 
       WHERE id IN ($1, $2) AND project_id = $3`,
      [predId, succId, projectId]
    );

    if (tasksCheck.rows.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'One or both tasks do not exist or do not belong to this project.',
      });
    }

    const predTask = tasksCheck.rows.find((i) => i.id === predId);
    const succTask = tasksCheck.rows.find((i) => i.id === succId);

    // Check if duplicate dependency already exists
    const dupCheck = await query(
      'SELECT id FROM task_dependencies WHERE predecessor_id = $1 AND successor_id = $2',
      [predId, succId]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A dependency link between task #${predId} and task #${succId} already exists.`,
      });
    }

    // ITPM Circular Dependency Guard (Cycle Detection)
    const hasCycle = await detectCycle(predId, succId);
    if (hasCycle) {
      return res.status(400).json({
        success: false,
        message: `Circular dependency detected: Linking #${predId} to #${succId} would create an infinite scheduling loop (Task #${succId} already leads back to #${predId}).`,
      });
    }

    // Insert dependency link
    const insertSql = `
      INSERT INTO task_dependencies (project_id, predecessor_id, successor_id, type, lag_days)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const insertResult = await query(insertSql, [projectId, predId, succId, normType, lag]);
    const createdDep = insertResult.rows[0];

    // Compute compliance feedback
    const compliance = evaluateDependencyCompliance(
      predTask.start_date,
      predTask.due_date,
      succTask.start_date,
      succTask.due_date,
      normType,
      lag
    );

    // Audit logs for both tasks
    await logActivity({
      taskId: predId,
      actor,
      actionType: 'dependency_added',
      fieldName: 'successor',
      oldValue: null,
      newValue: `Added ${normType} dependency to #${succId} (${succTask.title})`,
    });

    await logActivity({
      taskId: succId,
      actor,
      actionType: 'dependency_added',
      fieldName: 'predecessor',
      oldValue: null,
      newValue: `Added ${normType} dependency from #${predId} (${predTask.title})`,
    });

    res.status(201).json({
      success: true,
      message: `Created ${normType} dependency between ALPHA-${predId} and ALPHA-${succId}`,
      data: {
        ...createdDep,
        predecessor_title: predTask.title,
        successor_title: succTask.title,
        is_conflict: compliance.isConflict,
        conflict_reason: compliance.reason,
        slack_days: compliance.diffDays,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/dependencies/:id
 * Removes an existing task dependency relationship
 */
export async function deleteDependency(req, res, next) {
  try {
    const { id } = req.params;
    const actor = req.body?.actor || req.user?.name || 'User';

    const depCheck = await query(
      `SELECT d.*, p.title AS predecessor_title, s.title AS successor_title
       FROM task_dependencies d
       JOIN tasks p ON d.predecessor_id = p.id
       JOIN tasks s ON d.successor_id = s.id
       WHERE d.id = $1`,
      [id]
    );

    if (depCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Dependency link not found' });
    }

    const dep = depCheck.rows[0];

    await query('DELETE FROM task_dependencies WHERE id = $1', [id]);

    // Audit logging
    await logActivity({
      taskId: dep.predecessor_id,
      actor,
      actionType: 'dependency_removed',
      fieldName: 'successor',
      oldValue: `Removed ${dep.type} link to #${dep.successor_id}`,
      newValue: null,
    });

    await logActivity({
      taskId: dep.successor_id,
      actor,
      actionType: 'dependency_removed',
      fieldName: 'predecessor',
      oldValue: `Removed ${dep.type} link from #${dep.predecessor_id}`,
      newValue: null,
    });

    res.json({
      success: true,
      message: `Deleted dependency #${id} (${dep.type}) between #${dep.predecessor_id} and #${dep.successor_id}`,
      data: dep,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tasks/:taskId/dependencies (or /issues/:issueId/dependencies)
 * Retrieves all incoming (predecessors) and outgoing (successors) links for a single task
 */
export async function getTaskDependencies(req, res, next) {
  try {
    const taskId = req.params.taskId || req.params.issueId;

    const predecessorsSql = `
      SELECT 
        d.id AS dependency_id,
        d.type,
        d.lag_days,
        t.id AS task_id,
        t.id AS issue_id,
        t.title,
        t.status,
        t.priority,
        t.assignee,
        TO_CHAR(COALESCE(t.start_date, CURRENT_DATE), 'YYYY-MM-DD') AS start_date,
        TO_CHAR(COALESCE(t.due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS due_date
      FROM task_dependencies d
      JOIN tasks t ON d.predecessor_id = t.id
      WHERE d.successor_id = $1
      ORDER BY t.id ASC;
    `;

    const successorsSql = `
      SELECT 
        d.id AS dependency_id,
        d.type,
        d.lag_days,
        t.id AS task_id,
        t.id AS issue_id,
        t.title,
        t.status,
        t.priority,
        t.assignee,
        TO_CHAR(COALESCE(t.start_date, CURRENT_DATE), 'YYYY-MM-DD') AS start_date,
        TO_CHAR(COALESCE(t.due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS due_date
      FROM task_dependencies d
      JOIN tasks t ON d.successor_id = t.id
      WHERE d.predecessor_id = $1
      ORDER BY t.id ASC;
    `;

    const [predRes, succRes] = await Promise.all([
      query(predecessorsSql, [taskId]),
      query(successorsSql, [taskId]),
    ]);

    res.json({
      success: true,
      data: {
        predecessors: predRes.rows,
        successors: succRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

export const getIssueDependencies = getTaskDependencies;

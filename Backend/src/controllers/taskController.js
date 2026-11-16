import { query } from '../config/db.js';
import {
  isValidTransition,
  getAllowedTransitions,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../constants/stateMachine.js';
import {
  logActivity,
  getActivitiesByTask,
} from '../services/activityService.js';
import { getTagsForTask, attachTagToTask } from '../services/tagService.js';

// GET /api/projects/:projectId/tasks (or /issues)
export async function getTasksByProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const { status, priority, tag, search } = req.query;

    let sql = `
      SELECT 
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.creator,
        t.assignee,
        t.start_date,
        t.due_date,
        t.estimated_hours,
        t.progress,
        COALESCE((SELECT SUM(hours_spent) FROM time_logs WHERE task_id = t.id), 0)::NUMERIC(6,2) AS logged_hours,
        t.created_at,
        t.updated_at,
        p.name AS project_name,
        COUNT(DISTINCT c.id)::INT AS comment_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pr.id,
              'code', pr.code,
              'title', pr.title,
              'type', pr.type,
              'category', pr.category,
              'status', pr.status
            )
          ) FILTER (WHERE pr.id IS NOT NULL),
          '[]'
        ) AS requirements
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN comments c ON t.id = c.task_id
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      LEFT JOIN tags tg ON tt.tag_id = tg.id
      LEFT JOIN requirement_tasks rt ON t.id = rt.task_id
      LEFT JOIN project_requirements pr ON rt.requirement_id = pr.id
      WHERE t.project_id = $1
    `;

    const params = [projectId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    if (priority && priority !== 'all') {
      sql += ` AND t.priority = $${paramIndex++}`;
      params.push(priority);
    }

    if (tag && tag !== 'all') {
      sql += ` AND EXISTS (
        SELECT 1 FROM task_tags tt2
        JOIN tags tg2 ON tt2.tag_id = tg2.id
        WHERE tt2.task_id = t.id AND (tg2.name ILIKE $${paramIndex} OR tg2.id::text = $${paramIndex})
      )`;
      params.push(tag);
      paramIndex++;
    }

    if (search && search.trim()) {
      sql += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex} OR t.assignee ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    sql += `
      GROUP BY t.id, p.name
      ORDER BY 
        CASE t.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END ASC,
        t.created_at DESC;
    `;

    const result = await query(sql, params);

    // Decorate each task with allowed transitions for frontend convenience
    const tasks = result.rows.map((task) => ({
      ...task,
      allowed_transitions: getAllowedTransitions(task.status),
    }));

    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:projectId/tasks - Create a task under a project
export async function createTask(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title, description, priority = 'medium', creator, assignee, tagIds = [] } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    if (!creator || !creator.trim()) {
      return res.status(400).json({ success: false, message: 'Creator name is required' });
    }

    if (!TASK_PRIORITIES.includes(priority.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}`,
      });
    }

    // Verify project exists
    const projCheck = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const sql = `
      INSERT INTO tasks (project_id, title, description, priority, status, creator, assignee)
      VALUES ($1, $2, $3, $4, 'open', $5, $6)
      RETURNING *;
    `;

    const result = await query(sql, [
      projectId,
      title.trim(),
      description ? description.trim() : null,
      priority.toLowerCase(),
      creator.trim(),
      assignee ? assignee.trim() : null,
    ]);

    const createdTaskRaw = result.rows[0];

    // Attach initial tags if provided
    let attachedTags = [];
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      for (const tid of tagIds) {
        await attachTagToTask(createdTaskRaw.id, tid, creator.trim());
      }
      attachedTags = await getTagsForTask(createdTaskRaw.id);
    }

    const createdTask = {
      ...createdTaskRaw,
      comment_count: 0,
      tags: attachedTags,
      allowed_transitions: getAllowedTransitions(createdTaskRaw.status),
    };

    // Record creation audit trail
    await logActivity({
      taskId: createdTask.id,
      actor: createdTask.creator,
      actionType: 'task_created',
      newValue: createdTask.title,
    });

    res.status(201).json({ success: true, data: createdTask });
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks/:id - Get task detail with project metadata & comment count & tags
export async function getTaskById(req, res, next) {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.creator,
        t.assignee,
        t.start_date,
        t.due_date,
        t.estimated_hours,
        t.progress,
        COALESCE((SELECT SUM(hours_spent) FROM time_logs WHERE task_id = t.id), 0)::NUMERIC(6,2) AS logged_hours,
        t.created_at,
        t.updated_at,
        p.name AS project_name,
        COUNT(DISTINCT c.id)::INT AS comment_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pr.id,
              'code', pr.code,
              'title', pr.title,
              'type', pr.type,
              'category', pr.category,
              'status', pr.status
            )
          ) FILTER (WHERE pr.id IS NOT NULL),
          '[]'
        ) AS requirements
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN comments c ON t.id = c.task_id
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      LEFT JOIN tags tg ON tt.tag_id = tg.id
      LEFT JOIN requirement_tasks rt ON t.id = rt.task_id
      LEFT JOIN project_requirements pr ON rt.requirement_id = pr.id
      WHERE t.id = $1
      GROUP BY t.id, p.name;
    `;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = {
      ...result.rows[0],
      allowed_transitions: getAllowedTransitions(result.rows[0].status),
    };

    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:id/status - State Machine Validation
export async function updateTaskStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status: targetStatus } = req.body;

    if (!targetStatus) {
      return res.status(400).json({ success: false, message: 'Target status is required' });
    }

    const validStatuses = Object.values(TASK_STATUSES);
    if (!validStatuses.includes(targetStatus.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // 1. Fetch current status from database
    const taskQuery = await query('SELECT id, status, title FROM tasks WHERE id = $1', [id]);
    if (taskQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const currentStatus = taskQuery.rows[0].status;
    const normalizedTarget = targetStatus.toLowerCase();

    // 2. Business Constraint check via state machine rules
    if (!isValidTransition(currentStatus, normalizedTarget)) {
      const allowed = getAllowedTransitions(currentStatus);
      return res.status(422).json({
        success: false,
        code: 'INVALID_STATE_TRANSITION',
        message: `Invalid state transition! A task in '${currentStatus}' state cannot jump directly to '${normalizedTarget}'. Valid target states are: [${allowed.join(', ')}].`,
        currentStatus,
        attemptedStatus: normalizedTarget,
        allowedTransitions: allowed,
      });
    }

    // 3. Update status in database
    const updateSql = `
      UPDATE tasks
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await query(updateSql, [normalizedTarget, id]);

    // Record status transition audit trail
    const actor = req.body.actor || 'Piko';
    await logActivity({
      taskId: id,
      actor,
      actionType: 'status_change',
      fieldName: 'status',
      oldValue: currentStatus,
      newValue: normalizedTarget,
    });

    res.json({
      success: true,
      message: `Status transitioned from '${currentStatus}' to '${normalizedTarget}'.`,
      data: {
        ...result.rows[0],
        allowed_transitions: getAllowedTransitions(result.rows[0].status),
      },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/tasks/:id - Edit task details
export async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      priority,
      assignee,
      creator,
      startDate,
      start_date,
      dueDate,
      due_date,
      estimatedHours,
      estimated_hours,
      progress,
      actor = 'Piko',
    } = req.body;

    const existing = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const oldTask = existing.rows[0];

    const finalTitle = title !== undefined ? title.trim() : oldTask.title;
    if (!finalTitle) {
      return res.status(400).json({ success: false, message: 'Task title cannot be empty' });
    }

    if (priority && !TASK_PRIORITIES.includes(priority.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}`,
      });
    }

    const finalDesc = description !== undefined ? (description ? description.trim() : null) : oldTask.description;
    const finalPriority = priority !== undefined ? priority.toLowerCase() : oldTask.priority;
    const finalAssignee = assignee !== undefined ? (assignee ? assignee.trim() : null) : oldTask.assignee;
    const finalCreator = creator !== undefined ? (creator ? creator.trim() : oldTask.creator) : oldTask.creator;
    const finalStartDate = (start_date !== undefined ? start_date : startDate) !== undefined ? (start_date || startDate) : oldTask.start_date;
    const finalDueDate = (due_date !== undefined ? due_date : dueDate) !== undefined ? (due_date || dueDate) : oldTask.due_date;
    const finalEstimated = (estimated_hours !== undefined ? estimated_hours : estimatedHours) !== undefined ? Number(estimated_hours || estimatedHours) : oldTask.estimated_hours;
    const finalProgress = progress !== undefined ? Math.min(100, Math.max(0, parseInt(progress, 10))) : oldTask.progress;

    const sql = `
      UPDATE tasks
      SET 
        title = $1,
        description = $2,
        priority = $3,
        assignee = $4,
        creator = $5,
        start_date = $6,
        due_date = $7,
        estimated_hours = $8,
        progress = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *;
    `;

    const result = await query(sql, [
      finalTitle,
      finalDesc,
      finalPriority,
      finalAssignee,
      finalCreator,
      finalStartDate,
      finalDueDate,
      finalEstimated,
      finalProgress,
      id,
    ]);

    const updatedTask = result.rows[0];

    // Log priority change
    if (priority && priority.toLowerCase() !== oldTask.priority) {
      await logActivity({
        taskId: id,
        actor,
        actionType: 'priority_change',
        fieldName: 'priority',
        oldValue: oldTask.priority,
        newValue: priority.toLowerCase(),
      });
    }

    // Log assignee change
    if (assignee !== undefined && assignee !== oldTask.assignee) {
      await logActivity({
        taskId: id,
        actor,
        actionType: 'assignee_change',
        fieldName: 'assignee',
        oldValue: oldTask.assignee || 'Unassigned',
        newValue: assignee || 'Unassigned',
      });
    }

    // Log reporter change if altered
    if (creator !== undefined && creator !== oldTask.creator) {
      await logActivity({
        taskId: id,
        actor,
        actionType: 'reporter_change',
        fieldName: 'creator',
        oldValue: oldTask.creator,
        newValue: creator,
      });
    }

    // Log progress change if altered
    if (progress !== undefined && progress !== oldTask.progress) {
      await logActivity({
        taskId: id,
        actor,
        actionType: 'progress_update',
        fieldName: 'progress',
        oldValue: `${oldTask.progress}%`,
        newValue: `${finalProgress}%`,
      });
    }

    res.json({
      success: true,
      data: {
        ...updatedTask,
        allowed_transitions: getAllowedTransitions(updatedTask.status),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks/:id/activities - Activity and audit log history
export async function getTaskActivities(req, res, next) {
  try {
    const { id } = req.params;
    const activities = await getActivitiesByTask(id);
    res.json({ success: true, count: activities.length, data: activities });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tasks/:id - Delete task
export async function deleteTask(req, res, next) {
  try {
    const { id } = req.params;
    const sql = `
      DELETE FROM tasks
      WHERE id = $1
      RETURNING id, title, project_id;
    `;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({
      success: true,
      message: `Task '${result.rows[0].title}' was deleted.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// Backwards compatibility aliases for issueController
export const getIssuesByProject = getTasksByProject;
export const createIssue = createTask;
export const getIssueById = getTaskById;
export const updateIssueStatus = updateTaskStatus;
export const updateIssue = updateTask;
export const getIssueActivities = getTaskActivities;
export const deleteIssue = deleteTask;


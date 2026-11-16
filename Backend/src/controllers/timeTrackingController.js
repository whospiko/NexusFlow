import { query } from '../config/db.js';
import { logActivity } from '../services/activityService.js';
import { evaluateDependencyCompliance } from '../services/dependencyService.js';

// GET /api/projects/:projectId/gantt - Data for interactive Gantt Timeline Chart
export async function getProjectGantt(req, res, next) {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const projCheck = await query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const sql = `
      SELECT 
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assignee,
        t.creator,
        TO_CHAR(COALESCE(t.start_date, CURRENT_DATE), 'YYYY-MM-DD') AS start_date,
        TO_CHAR(COALESCE(t.due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS due_date,
        COALESCE(t.estimated_hours, 8.0)::NUMERIC(6,2) AS estimated_hours,
        COALESCE(t.progress, 0) AS progress,
        COALESCE((SELECT SUM(hours_spent) FROM time_logs WHERE task_id = t.id), 0)::NUMERIC(6,2) AS logged_hours,
        GREATEST(1, (COALESCE(t.due_date, CURRENT_DATE + INTERVAL '7 days')::date - COALESCE(t.start_date, CURRENT_DATE)::date) + 1) AS duration_days,
        p.name AS project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.project_id = $1
      ORDER BY t.start_date ASC, t.id ASC;
    `;

    const result = await query(sql, [projectId]);

    // Also fetch ITPM dependencies for this project
    const depsSql = `
      SELECT 
        d.id,
        d.project_id,
        d.predecessor_id,
        d.successor_id,
        d.type,
        d.lag_days,
        p_task.title AS predecessor_title,
        p_task.priority AS predecessor_priority,
        p_task.status AS predecessor_status,
        TO_CHAR(COALESCE(p_task.start_date, CURRENT_DATE), 'YYYY-MM-DD') AS predecessor_start_date,
        TO_CHAR(COALESCE(p_task.due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS predecessor_due_date,
        s_task.title AS successor_title,
        s_task.priority AS successor_priority,
        s_task.status AS successor_status,
        TO_CHAR(COALESCE(s_task.start_date, CURRENT_DATE), 'YYYY-MM-DD') AS successor_start_date,
        TO_CHAR(COALESCE(s_task.due_date, CURRENT_DATE + INTERVAL '7 days'), 'YYYY-MM-DD') AS successor_due_date
      FROM task_dependencies d
      JOIN tasks p_task ON d.predecessor_id = p_task.id
      JOIN tasks s_task ON d.successor_id = s_task.id
      WHERE d.project_id = $1
      ORDER BY d.id ASC;
    `;
    const depsResult = await query(depsSql, [projectId]).catch(() => ({ rows: [] }));

    const enrichedDeps = depsResult.rows.map((row) => {
      const comp = evaluateDependencyCompliance(
        row.predecessor_start_date,
        row.predecessor_due_date,
        row.successor_start_date,
        row.successor_due_date,
        row.type,
        row.lag_days
      );
      return {
        ...row,
        is_conflict: comp.isConflict,
        conflict_reason: comp.reason,
        slack_days: comp.diffDays,
      };
    });

    res.json({
      success: true,
      project: projCheck.rows[0],
      count: result.rows.length,
      data: result.rows,
      dependencies: enrichedDeps,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:projectId/timesheets - Weekly timesheet grid with per-task & per-member breakdown
export async function getProjectTimesheets(req, res, next) {
  try {
    const { projectId } = req.params;
    let { startDate, endDate } = req.query;

    // Default to current week Monday through Sunday
    if (!startDate || !endDate) {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diffToMon));
      const sun = new Date(new Date(mon).setDate(mon.getDate() + 6));
      startDate = mon.toISOString().split('T')[0];
      endDate = sun.toISOString().split('T')[0];
    }

    // 1. Fetch raw logs in timeframe
    const logsSql = `
      SELECT 
        tl.id,
        tl.task_id,
        tl.task_id AS issue_id,
        t.title AS issue_title,
        t.title AS task_title,
        t.status AS issue_status,
        t.status AS task_status,
        t.priority AS issue_priority,
        t.priority AS task_priority,
        t.estimated_hours,
        t.progress,
        tl.author,
        TO_CHAR(tl.log_date, 'YYYY-MM-DD') AS log_date,
        tl.hours_spent,
        tl.description
      FROM time_logs tl
      JOIN tasks t ON tl.task_id = t.id
      WHERE tl.project_id = $1 AND tl.log_date BETWEEN $2::date AND $3::date
      ORDER BY tl.author ASC, tl.log_date ASC;
    `;
    const logsRes = await query(logsSql, [projectId, startDate, endDate]);

    // 2. Fetch all project tasks to allow logging even if 0 hours logged this week
    const tasksSql = `
      SELECT 
        t.id,
        t.title,
        t.status,
        t.priority,
        t.assignee,
        COALESCE(t.estimated_hours, 8.0)::NUMERIC(6,2) AS estimated_hours,
        COALESCE(t.progress, 0) AS progress,
        COALESCE((SELECT SUM(hours_spent) FROM time_logs WHERE task_id = t.id), 0)::NUMERIC(6,2) AS total_logged_hours
      FROM tasks t
      WHERE t.project_id = $1
      ORDER BY t.id ASC;
    `;
    const tasksRes = await query(tasksSql, [projectId]);

    // Generate days of the week array
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    const curr = new Date(start);
    while (curr <= end) {
      days.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    // Build row aggregations by Task & Author
    const rowMap = new Map();
    let grandTotalHours = 0;

    for (const log of logsRes.rows) {
      const key = `${log.task_id}-${log.author}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          task_id: log.task_id,
          issue_id: log.task_id,
          issue_title: log.task_title,
          task_title: log.task_title,
          issue_status: log.task_status,
          task_status: log.task_status,
          issue_priority: log.task_priority,
          task_priority: log.task_priority,
          estimated_hours: log.estimated_hours,
          progress: log.progress,
          author: log.author,
          daily_hours: {},
          total_hours: 0,
        });
      }
      const row = rowMap.get(key);
      const hrs = Number(log.hours_spent);
      row.daily_hours[log.log_date] = (row.daily_hours[log.log_date] || 0) + hrs;
      row.total_hours += hrs;
      grandTotalHours += hrs;
    }

    const rows = Array.from(rowMap.values());

    res.json({
      success: true,
      timeframe: { startDate, endDate, days },
      grandTotalHours: Number(grandTotalHours.toFixed(2)),
      rows,
      projectTasks: tasksRes.rows,
      projectIssues: tasksRes.rows,
      rawLogs: logsRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:projectId/workload - Workload Management & Capacity Allocation
export async function getProjectWorkload(req, res, next) {
  try {
    const { projectId } = req.params;

    // 1. Fetch team members of this project (deduplicated)
    const membersSql = `
      SELECT DISTINCT ON (u.id)
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        COALESCE(pm.role, 'Owner') as role
      FROM projects p
      JOIN users u ON (p.owner_id = u.id OR EXISTS (SELECT 1 FROM project_members pm2 WHERE pm2.project_id = p.id AND pm2.user_id = u.id))
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = u.id
      WHERE p.id = $1
      ORDER BY u.id, role;
    `;
    const membersRes = await query(membersSql, [projectId]);
    const members = membersRes.rows;

    // 2. Fetch assigned tasks per member
    const tasksSql = `
      SELECT 
        t.id,
        t.title,
        t.status,
        t.priority,
        t.assignee,
        TO_CHAR(t.start_date, 'YYYY-MM-DD') AS start_date,
        TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
        COALESCE(t.estimated_hours, 8.0)::NUMERIC(6,2) AS estimated_hours,
        COALESCE(t.progress, 0) AS progress,
        COALESCE((SELECT SUM(hours_spent) FROM time_logs WHERE task_id = t.id), 0)::NUMERIC(6,2) AS logged_hours
      FROM tasks t
      WHERE t.project_id = $1 AND t.assignee IS NOT NULL
      ORDER BY t.due_date ASC;
    `;
    const tasksRes = await query(tasksSql, [projectId]);

    // 3. Fetch logged hours in past 14 days
    const logsSql = `
      SELECT 
        author,
        TO_CHAR(log_date, 'YYYY-MM-DD') as log_date,
        SUM(hours_spent)::NUMERIC(6,2) as hours
      FROM time_logs
      WHERE project_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY author, log_date
      ORDER BY author, log_date;
    `;
    const logsRes = await query(logsSql, [projectId]);

    // Build per-member capacity summary
    const workloadData = members.map((member) => {
      const assignedTasks = tasksRes.rows.filter(
        (t) => t.assignee?.toLowerCase() === member.name?.toLowerCase()
      );
      const activeTasks = assignedTasks.filter((t) => t.status !== 'closed');
      const totalEstimatedHours = activeTasks.reduce(
        (sum, t) => sum + Number(t.estimated_hours),
        0
      );
      const totalLoggedHours = assignedTasks.reduce(
        (sum, t) => sum + Number(t.logged_hours),
        0
      );

      // Weekly capacity standard: 40 hours
      const standardWeeklyCapacity = 40;
      let capacityStatus = 'optimal'; // 'underutilized' | 'optimal' | 'burnout_risk'
      if (totalEstimatedHours > standardWeeklyCapacity * 1.25) {
        capacityStatus = 'burnout_risk';
      } else if (totalEstimatedHours < standardWeeklyCapacity * 0.4) {
        capacityStatus = 'underutilized';
      }

      // Member daily logs map
      const memberLogs = logsRes.rows.filter(
        (l) => l.author?.toLowerCase() === member.name?.toLowerCase()
      );
      const dailyHoursMap = {};
      memberLogs.forEach((l) => {
        dailyHoursMap[l.log_date] = Number(l.hours);
      });

      return {
        member,
        activeTasksCount: activeTasks.length,
        totalTasksCount: assignedTasks.length,
        totalEstimatedHours: Number(totalEstimatedHours.toFixed(1)),
        totalLoggedHours: Number(totalLoggedHours.toFixed(1)),
        capacityHours: standardWeeklyCapacity,
        capacityPercentage: Math.min(
          150,
          Math.round((totalEstimatedHours / standardWeeklyCapacity) * 100)
        ),
        capacityStatus,
        assignedTasks,
        dailyHoursMap,
      };
    });

    res.json({
      success: true,
      count: workloadData.length,
      data: workloadData,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks/:taskId/time-logs (or /issues/:issueId/time-logs) - Log work hours on a task
export async function createTimeLog(req, res, next) {
  try {
    const taskId = req.params.taskId || req.params.issueId;
    const { hours_spent, log_date, description, author = 'Piko', new_progress } = req.body;

    const hours = Number(hours_spent);
    if (!hours || isNaN(hours) || hours <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive hours_spent is required' });
    }

    // Verify task exists
    const taskCheck = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskCheck.rows[0];

    const targetDate = log_date ? log_date : new Date().toISOString().split('T')[0];

    // Insert time log
    const insertSql = `
      INSERT INTO time_logs (project_id, task_id, author, hours_spent, log_date, description)
      VALUES ($1, $2, $3, $4, $5::date, $6)
      RETURNING *, task_id AS issue_id;
    `;
    const result = await query(insertSql, [
      task.project_id,
      taskId,
      author.trim(),
      hours,
      targetDate,
      description ? description.trim() : null,
    ]);
    const createdLog = result.rows[0];

    // Optionally update task progress %
    let updatedProgress = task.progress;
    if (new_progress !== undefined && new_progress !== null) {
      updatedProgress = Math.min(100, Math.max(0, parseInt(new_progress, 10)));
      await query('UPDATE tasks SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        updatedProgress,
        taskId,
      ]);
    } else {
      // Auto compute progress if not explicitly provided
      const totalLoggedRes = await query('SELECT SUM(hours_spent) as total FROM time_logs WHERE task_id = $1', [taskId]);
      const totalLogged = Number(totalLoggedRes.rows[0]?.total || 0);
      const est = Number(task.estimated_hours || 8.0);
      if (est > 0) {
        updatedProgress = Math.min(100, Math.round((totalLogged / est) * 100));
        await query('UPDATE tasks SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
          updatedProgress,
          taskId,
        ]);
      }
    }

    // Log activity in task_activities
    await logActivity({
      taskId,
      actor: author.trim(),
      actionType: 'work_logged',
      fieldName: 'hours_spent',
      oldValue: `${task.progress}%`,
      newValue: `Logged ${hours}h (${updatedProgress}% progress)`,
    });

    res.status(201).json({
      success: true,
      message: 'Work logged successfully',
      data: createdLog,
      progress: updatedProgress,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks/:taskId/time-logs (or /issues/:issueId/time-logs) - List all time logs for a task
export async function getTimeLogsByTask(req, res, next) {
  try {
    const taskId = req.params.taskId || req.params.issueId;

    const sql = `
      SELECT 
        id,
        project_id,
        task_id,
        task_id AS issue_id,
        author,
        hours_spent,
        TO_CHAR(log_date, 'YYYY-MM-DD') as log_date,
        description,
        created_at
      FROM time_logs
      WHERE task_id = $1
      ORDER BY log_date DESC, created_at DESC;
    `;
    const result = await query(sql, [taskId]);

    const totalHours = result.rows.reduce((sum, r) => sum + Number(r.hours_spent), 0);

    res.json({
      success: true,
      count: result.rows.length,
      totalHours: Number(totalHours.toFixed(2)),
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

export const getTimeLogsByIssue = getTimeLogsByTask;

// DELETE /api/time-logs/:id - Delete a time log
export async function deleteTimeLog(req, res, next) {
  try {
    const { id } = req.params;

    const checkSql = 'SELECT * FROM time_logs WHERE id = $1';
    const checkRes = await query(checkSql, [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Time log not found' });
    }
    const log = checkRes.rows[0];

    await query('DELETE FROM time_logs WHERE id = $1', [id]);

    // Recalculate progress
    const totalLoggedRes = await query('SELECT SUM(hours_spent) as total FROM time_logs WHERE task_id = $1', [log.task_id]);
    const totalLogged = Number(totalLoggedRes.rows[0]?.total || 0);
    const taskRes = await query('SELECT estimated_hours FROM tasks WHERE id = $1', [log.task_id]);
    const est = Number(taskRes.rows[0]?.estimated_hours || 8.0);
    const newProgress = est > 0 ? Math.min(100, Math.round((totalLogged / est) * 100)) : 0;
    await query('UPDATE tasks SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newProgress, log.task_id]);

    res.json({ success: true, message: 'Time log deleted', newProgress });
  } catch (err) {
    next(err);
  }
}

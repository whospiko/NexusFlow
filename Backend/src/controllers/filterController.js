import { query } from '../config/db.js';

// GET /api/filters/tasks (or /filters/issues) - Cross-project or scoped task filtering & preset queries
export async function getFilteredTasks(req, res, next) {
  try {
    const userId = req.user?.id;
    const currentUserName = req.user?.name || req.query.user || 'User';

    const {
      preset,
      projectId,
      status,
      priority,
      assignee,
      tag,
      search,
    } = req.query;

    const params = [];
    let paramIndex = 1;

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
    `;

    // 1. STRICT ACCOUNT MULTI-TENANCY FILTER:
    // Only return tasks belonging to projects that the user owns OR is a verified member of!
    if (userId) {
      sql += `
        WHERE (
          p.owner_id = $${paramIndex}
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = $${paramIndex}
          )
        )
      `;
      params.push(userId);
      paramIndex++;
    } else {
      sql += ` WHERE 1=1`;
    }

    // 2. Apply Jira System Presets
    if (preset === 'my_open') {
      sql += ` AND t.assignee ILIKE $${paramIndex++} AND t.status != 'closed'`;
      params.push(`%${currentUserName}%`);
    } else if (preset === 'reported_by_me') {
      sql += ` AND t.creator ILIKE $${paramIndex++}`;
      params.push(`%${currentUserName}%`);
    } else if (preset === 'critical_blockers') {
      sql += ` AND t.priority IN ('critical', 'high') AND t.status != 'closed'`;
    } else if (preset === 'in_progress') {
      sql += ` AND t.status = 'in-progress'`;
    } else if (preset === 'done') {
      sql += ` AND t.status IN ('resolved', 'closed')`;
    }

    // 3. Dynamic filters
    if (projectId && projectId !== 'all') {
      sql += ` AND t.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (status && status !== 'all') {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    if (priority && priority !== 'all') {
      sql += ` AND t.priority = $${paramIndex++}`;
      params.push(priority);
    }

    if (assignee && assignee !== 'all') {
      sql += ` AND t.assignee ILIKE $${paramIndex++}`;
      params.push(`%${assignee}%`);
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
      sql += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex} OR t.assignee ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    sql += `
      GROUP BY t.id, p.name
      ORDER BY t.created_at DESC;
    `;

    const result = await query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
}

export const getFilteredIssues = getFilteredTasks;

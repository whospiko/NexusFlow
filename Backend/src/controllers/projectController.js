import { query } from '../config/db.js';

// GET /api/projects - List projects scoped to the authenticated user's tenancy
export async function getProjects(req, res, next) {
  try {
    const userId = req.user?.id;

    // If authenticated, isolate to projects where user is owner OR member
    let sql;
    let params = [];

    if (userId) {
      sql = `
        SELECT 
          p.id,
          p.name,
          p.description,
          p.created_at,
          p.updated_at,
          p.owner_id,
          u.name AS owner_name,
          u.email AS owner_email,
          (p.owner_id = $1) AS is_owner,
          COALESCE(pm.role, CASE WHEN p.owner_id = $1 THEN 'owner' ELSE 'member' END) AS my_role,
          COUNT(DISTINCT t.id)::INT AS total_tasks,
          COUNT(DISTINCT t.id)::INT AS total_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END)::INT AS open_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END)::INT AS open_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'in-progress' THEN t.id END)::INT AS in_progress_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'in-progress' THEN t.id END)::INT AS in_progress_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'resolved' THEN t.id END)::INT AS resolved_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'resolved' THEN t.id END)::INT AS resolved_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END)::INT AS closed_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END)::INT AS closed_issues,
          COUNT(DISTINCT pm_all.user_id)::INT AS team_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
        LEFT JOIN project_members pm_all ON p.id = pm_all.project_id
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.owner_id = $1 OR pm.user_id = $1
        GROUP BY p.id, u.name, u.email, pm.role
        ORDER BY p.created_at DESC;
      `;
      params = [userId];
    } else {
      // Unauthenticated fallback: show public projects or all seeded demo projects
      sql = `
        SELECT 
          p.id,
          p.name,
          p.description,
          p.created_at,
          p.updated_at,
          p.owner_id,
          u.name AS owner_name,
          u.email AS owner_email,
          false AS is_owner,
          'viewer' AS my_role,
          COUNT(DISTINCT t.id)::INT AS total_tasks,
          COUNT(DISTINCT t.id)::INT AS total_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END)::INT AS open_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END)::INT AS open_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'in-progress' THEN t.id END)::INT AS in_progress_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'in-progress' THEN t.id END)::INT AS in_progress_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'resolved' THEN t.id END)::INT AS resolved_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'resolved' THEN t.id END)::INT AS resolved_issues,
          COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END)::INT AS closed_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END)::INT AS closed_issues,
          COUNT(DISTINCT pm_all.user_id)::INT AS team_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_members pm_all ON p.id = pm_all.project_id
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY p.id, u.name, u.email
        ORDER BY p.created_at DESC;
      `;
    }

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id - Single project details with membership verification
export async function getProjectById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.created_at,
        p.updated_at,
        p.owner_id,
        u.name AS owner_name,
        u.email AS owner_email,
        u.avatar_url AS owner_avatar,
        COUNT(DISTINCT t.id)::INT AS total_tasks,
        COUNT(DISTINCT t.id)::INT AS total_issues,
        COUNT(DISTINCT pm.user_id)::INT AS team_count,
        EXISTS (
          SELECT 1 FROM project_members check_pm 
          WHERE check_pm.project_id = p.id AND check_pm.user_id = $2
        ) AS is_member,
        (p.owner_id = $2) AS is_owner
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE p.id = $1
      GROUP BY p.id, u.name, u.email, u.avatar_url;
    `;
    const result = await query(sql, [id, userId || -1]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const project = result.rows[0];

    // Multi-tenancy access check: if user is logged in, they must be owner or member
    if (userId && !project.is_owner && !project.is_member) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project team. Please request an invitation from the project owner.',
      });
    }

    res.json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects - Create a new project isolated to the creator
export async function createProject(req, res, next) {
  try {
    const { name, description } = req.body;
    const ownerId = req.user ? req.user.id : 1; // Default to first user if unauthenticated

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    // 1. Create project with owner_id
    const sql = `
      INSERT INTO projects (name, description, owner_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await query(sql, [name.trim(), description ? description.trim() : null, ownerId]);
    const project = result.rows[0];

    // 2. Automatically register creator into project_members with role 'owner'
    const memberSql = `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, 'owner')
      ON CONFLICT DO NOTHING;
    `;
    await query(memberSql, [project.id, ownerId]);

    res.status(201).json({
      success: true,
      data: {
        ...project,
        is_owner: true,
        my_role: 'owner',
        total_issues: 0,
        team_count: 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id - Update project (Only owner or admin)
export async function updateProject(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user?.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    // Check ownership / admin role
    if (userId) {
      const checkSql = `
        SELECT p.owner_id, pm.role 
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
        WHERE p.id = $2;
      `;
      const check = await query(checkSql, [userId, id]);
      if (check.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      const isOwner = check.rows[0].owner_id === userId;
      const isAdmin = check.rows[0].role === 'admin' || check.rows[0].role === 'owner';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Only project owners or admins can edit project settings' });
      }
    }

    const sql = `
      UPDATE projects
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const result = await query(sql, [name.trim(), description ? description.trim() : null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id - Delete project (Only owner)
export async function deleteProject(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (userId) {
      const checkSql = 'SELECT owner_id FROM projects WHERE id = $1;';
      const check = await query(checkSql, [id]);
      if (check.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      if (check.rows[0].owner_id !== userId) {
        return res.status(403).json({ success: false, message: 'Only the project owner can delete this project' });
      }
    }

    const sql = `
      DELETE FROM projects
      WHERE id = $1
      RETURNING id, name;
    `;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({
      success: true,
      message: `Project '${result.rows[0].name}' and all associated issues/comments were deleted.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:id/duplicate
 * Clone an entire project model as a template (tasks, requirements, dependencies, members)
 */
export async function duplicateProject(req, res, next) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      cloneTasks = true,
      cloneRequirements = true,
      cloneMembers = true,
      cloneDependencies = true,
      resetTaskStatus = false,
      resetStatus = false,
    } = req.body;

    const shouldReset = Boolean(resetTaskStatus || resetStatus);

    const callerId = req.user?.id || 1;

    // 1. Fetch source project
    const projCheck = await query('SELECT * FROM projects WHERE id = $1', [id]);
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Source project not found to duplicate' });
    }
    const source = projCheck.rows[0];

    const targetName = name && name.trim() ? name.trim() : `${source.name} (Copy)`;
    const targetDesc = description !== undefined ? (description ? description.trim() : null) : source.description;

    // 2. Create the cloned project
    const createRes = await query(
      'INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [targetName, targetDesc, callerId]
    );
    const newProject = createRes.rows[0];

    // 3. Register caller as owner
    await query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [newProject.id, callerId, 'owner']
    );

    // 4. Clone team members if requested
    if (cloneMembers) {
      const membersRes = await query(
        'SELECT user_id, role FROM project_members WHERE project_id = $1 AND user_id <> $2',
        [id, callerId]
      );
      for (const m of membersRes.rows) {
        await query(
          'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [newProject.id, m.user_id, m.role]
        );
      }
    }

    const taskIdMap = new Map(); // oldTaskId -> newTaskId

    // 5. Clone tasks if requested
    if (cloneTasks) {
      const tasksRes = await query(
        'SELECT * FROM tasks WHERE project_id = $1 ORDER BY id ASC',
        [id]
      );

      for (const t of tasksRes.rows) {
        const finalStatus = shouldReset ? 'open' : t.status;
        const finalProgress = shouldReset ? 0 : t.progress;

        const insertTaskRes = await query(`
          INSERT INTO tasks (
            project_id, title, description, priority, status, creator, assignee,
            start_date, due_date, estimated_hours, progress
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id;
        `, [
          newProject.id,
          t.title,
          t.description,
          t.priority,
          finalStatus,
          req.user?.name || t.creator,
          t.assignee,
          t.start_date,
          t.due_date,
          t.estimated_hours,
          finalProgress,
        ]);

        const newTaskId = insertTaskRes.rows[0].id;
        taskIdMap.set(t.id, newTaskId);

        // Copy task tags
        const tagsRes = await query('SELECT tag_id FROM task_tags WHERE task_id = $1', [t.id]);
        for (const tg of tagsRes.rows) {
          await query(
            'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newTaskId, tg.tag_id]
          );
        }
      }

      // 6. Clone task dependencies if requested (re-mapping predecessor & successor)
      if (cloneDependencies) {
        const depsRes = await query(
          'SELECT predecessor_id, successor_id, type, lag_days FROM task_dependencies WHERE project_id = $1',
          [id]
        );

        for (const dep of depsRes.rows) {
          const newPred = taskIdMap.get(dep.predecessor_id);
          const newSucc = taskIdMap.get(dep.successor_id);
          if (newPred && newSucc) {
            await query(`
              INSERT INTO task_dependencies (project_id, predecessor_id, successor_id, type, lag_days)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT DO NOTHING;
            `, [newProject.id, newPred, newSucc, dep.type, dep.lag_days]);
          }
        }
      }
    }

    // 7. Clone requirements and re-map traceability if requested
    if (cloneRequirements) {
      const reqsRes = await query(
        'SELECT * FROM project_requirements WHERE project_id = $1 ORDER BY id ASC',
        [id]
      );

      for (const r of reqsRes.rows) {
        const insertReqRes = await query(`
          INSERT INTO project_requirements (
            project_id, code, title, type, category, business_problem,
            stakeholders, solution_concept, details, acceptance_criteria,
            priority, status, iteration_cycle
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id;
        `, [
          newProject.id,
          r.code,
          r.title,
          r.type,
          r.category,
          r.business_problem,
          r.stakeholders,
          r.solution_concept,
          r.details,
          r.acceptance_criteria,
          r.priority,
          r.status,
          r.iteration_cycle,
        ]);

        const newReqId = insertReqRes.rows[0].id;

        // Re-link cloned tasks to cloned requirement
        if (cloneTasks) {
          const linkedRes = await query(
            'SELECT task_id FROM requirement_tasks WHERE requirement_id = $1',
            [r.id]
          );
          for (const lr of linkedRes.rows) {
            const mappedTaskId = taskIdMap.get(lr.task_id);
            if (mappedTaskId) {
              await query(
                'INSERT INTO requirement_tasks (requirement_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [newReqId, mappedTaskId]
              );
            }
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Project '${source.name}' duplicated successfully as '${newProject.name}'.`,
      data: {
        ...newProject,
        is_owner: true,
        my_role: 'owner',
        cloned_tasks_count: taskIdMap.size,
      },
    });
  } catch (err) {
    next(err);
  }
}

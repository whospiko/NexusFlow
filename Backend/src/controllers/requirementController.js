import { query } from '../config/db.js';
import { logActivity } from '../services/activityService.js';

/**
 * GET /api/projects/:projectId/requirements
 * Retrieves all Requirements, Problems, FRs, and NFRs with Linked Tasks and Traceability Stats
 */
export async function getProjectRequirements(req, res, next) {
  try {
    const { projectId } = req.params;
    const { type, status, category, search } = req.query;

    let sql = `
      SELECT 
        r.id,
        r.project_id,
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
        r.created_at,
        r.updated_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', t.id,
              'title', t.title,
              'status', t.status,
              'priority', t.priority,
              'progress', t.progress,
              'assignee', t.assignee
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS linked_tasks
      FROM project_requirements r
      LEFT JOIN requirement_tasks rt ON r.id = rt.requirement_id
      LEFT JOIN tasks t ON rt.task_id = t.id
      WHERE r.project_id = $1
    `;

    const params = [projectId];
    let paramIndex = 2;

    if (type && type !== 'all') {
      sql += ` AND r.type = $${paramIndex++}`;
      params.push(type);
    }

    if (status && status !== 'all') {
      sql += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    if (category && category !== 'all') {
      sql += ` AND r.category = $${paramIndex++}`;
      params.push(category);
    }

    if (search && search.trim()) {
      sql += ` AND (
        r.code ILIKE $${paramIndex} 
        OR r.title ILIKE $${paramIndex} 
        OR r.details ILIKE $${paramIndex}
        OR r.business_problem ILIKE $${paramIndex}
        OR r.solution_concept ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    sql += `
      GROUP BY r.id
      ORDER BY 
        CASE r.type
          WHEN 'problem' THEN 1
          WHEN 'stakeholder_need' THEN 2
          WHEN 'NFR' THEN 3
          WHEN 'FR' THEN 4
          ELSE 5
        END ASC,
        r.id ASC;
    `;

    const result = await query(sql, params);
    const requirements = result.rows;

    // Compute Traceability Metrics for SE / ITPM Leads
    const totalRequirements = requirements.length;
    const functionalCount = requirements.filter((r) => r.type === 'FR').length;
    const nonFunctionalCount = requirements.filter((r) => r.type === 'NFR').length;
    const problemCount = requirements.filter((r) => r.type === 'problem' || r.type === 'stakeholder_need').length;
    const coveredCount = requirements.filter((r) => r.linked_tasks && r.linked_tasks.length > 0).length;
    const validatedCount = requirements.filter((r) => r.status === 'validated').length;
    const implementedCount = requirements.filter((r) => r.status === 'implemented' || r.status === 'validated').length;

    const coveragePercentage = totalRequirements > 0 ? Math.round((coveredCount / totalRequirements) * 100) : 0;
    const validationPercentage = totalRequirements > 0 ? Math.round((validatedCount / totalRequirements) * 100) : 0;

    const metricsPayload = {
      totalRequirements,
      functionalCount,
      nonFunctionalCount,
      problemCount,
      coveredCount,
      validatedCount,
      implementedCount,
      coveragePercentage,
      validationPercentage,
    };

    res.json({
      success: true,
      count: totalRequirements,
      metrics: metricsPayload,
      data: requirements,
      requirements,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/requirements
 * Creates a new requirement item (Problem, Need, FR, or NFR) with optional linked tasks
 */
export async function createRequirement(req, res, next) {
  try {
    const { projectId } = req.params;
    const {
      code,
      title,
      type = 'FR',
      category = 'general',
      business_problem,
      stakeholders,
      solution_concept,
      details,
      acceptance_criteria,
      priority = 'medium',
      status = 'draft',
      iteration_cycle = 1,
      task_ids = [],
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Requirement title is required.' });
    }

    if (!details || !details.trim()) {
      return res.status(400).json({ success: false, message: 'Requirement details/specification statement is required.' });
    }

    // Auto-generate human-friendly code if omitted
    let finalCode = code && code.trim() ? code.trim().toUpperCase() : '';
    if (!finalCode) {
      const countRes = await query('SELECT COUNT(*) FROM project_requirements WHERE project_id = $1', [projectId]);
      const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
      const prefix = type === 'NFR' ? 'NFR' : type === 'problem' ? 'PROB' : 'FR';
      finalCode = `${prefix}-${String(nextNum).padStart(2, '0')}`;
    }

    const insertSql = `
      INSERT INTO project_requirements (
        project_id, code, title, type, category, 
        business_problem, stakeholders, solution_concept, 
        details, acceptance_criteria, priority, status, iteration_cycle
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const result = await query(insertSql, [
      projectId,
      finalCode,
      title.trim(),
      type,
      category || 'general',
      business_problem ? business_problem.trim() : null,
      stakeholders ? stakeholders.trim() : null,
      solution_concept ? solution_concept.trim() : null,
      details.trim(),
      acceptance_criteria ? acceptance_criteria.trim() : null,
      priority.toLowerCase(),
      status.toLowerCase(),
      parseInt(iteration_cycle, 10) || 1,
    ]);

    const createdReq = result.rows[0];

    // Link initial tasks if provided
    const initialTasks = Array.isArray(req.body.taskIds) ? req.body.taskIds : (Array.isArray(task_ids) ? task_ids : []);
    if (initialTasks.length > 0) {
      for (const tid of initialTasks) {
        await query(
          'INSERT INTO requirement_tasks (requirement_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [createdReq.id, tid]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Requirement recorded successfully.',
      data: createdReq,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/requirements/:id
 * Updates an existing requirement and its attributes / iteration cycle
 */
export async function updateRequirement(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      code,
      type,
      category,
      business_problem,
      stakeholders,
      solution_concept,
      details,
      acceptance_criteria,
      priority,
      status,
      iteration_cycle,
      task_ids,
    } = req.body;

    const existingRes = await query('SELECT * FROM project_requirements WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Requirement not found.' });
    }
    const oldReq = existingRes.rows[0];

    const finalTitle = title !== undefined ? title.trim() : oldReq.title;
    const finalCode = code !== undefined ? code.trim().toUpperCase() : oldReq.code;
    const finalType = type !== undefined ? type : oldReq.type;
    const finalCategory = category !== undefined ? category : oldReq.category;
    const finalProblem = business_problem !== undefined ? (business_problem ? business_problem.trim() : null) : oldReq.business_problem;
    const finalStakeholders = stakeholders !== undefined ? (stakeholders ? stakeholders.trim() : null) : oldReq.stakeholders;
    const finalSolution = solution_concept !== undefined ? (solution_concept ? solution_concept.trim() : null) : oldReq.solution_concept;
    const finalDetails = details !== undefined ? details.trim() : oldReq.details;
    const finalAcceptance = acceptance_criteria !== undefined ? (acceptance_criteria ? acceptance_criteria.trim() : null) : oldReq.acceptance_criteria;
    const finalPriority = priority !== undefined ? priority.toLowerCase() : oldReq.priority;
    const finalStatus = status !== undefined ? status.toLowerCase() : oldReq.status;
    const finalCycle = iteration_cycle !== undefined ? parseInt(iteration_cycle, 10) : oldReq.iteration_cycle;

    const updateSql = `
      UPDATE project_requirements
      SET
        code = $1,
        title = $2,
        type = $3,
        category = $4,
        business_problem = $5,
        stakeholders = $6,
        solution_concept = $7,
        details = $8,
        acceptance_criteria = $9,
        priority = $10,
        status = $11,
        iteration_cycle = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *;
    `;

    const result = await query(updateSql, [
      finalCode,
      finalTitle,
      finalType,
      finalCategory,
      finalProblem,
      finalStakeholders,
      finalSolution,
      finalDetails,
      finalAcceptance,
      finalPriority,
      finalStatus,
      finalCycle,
      id,
    ]);

    // Update linked tasks if explicitly provided (supports both taskIds and task_ids, including empty array [] to unlink all)
    const finalTaskIds = req.body.taskIds !== undefined ? req.body.taskIds : (req.body.task_ids !== undefined ? req.body.task_ids : null);
    if (Array.isArray(finalTaskIds)) {
      await query('DELETE FROM requirement_tasks WHERE requirement_id = $1', [id]);
      for (const tid of finalTaskIds) {
        await query(
          'INSERT INTO requirement_tasks (requirement_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, tid]
        );
      }
    }

    res.json({
      success: true,
      message: 'Requirement updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/requirements/:id
 */
export async function deleteRequirement(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM project_requirements WHERE id = $1 RETURNING id, code, title', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Requirement not found.' });
    }
    res.json({
      success: true,
      message: `Requirement ${result.rows[0].code} deleted successfully.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/requirements/:id/tasks
 * Link a task to a requirement for bidirectional traceability
 */
export async function linkTaskToRequirement(req, res, next) {
  try {
    const { id } = req.params;
    const taskIdToLink = req.body.task_id || req.body.taskId;

    if (!taskIdToLink) {
      return res.status(400).json({ success: false, message: 'task_id or taskId is required.' });
    }

    await query(
      'INSERT INTO requirement_tasks (requirement_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, taskIdToLink]
    );

    res.status(201).json({
      success: true,
      message: 'Task linked to requirement for traceability.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/requirements/:id/tasks/:taskId
 */
export async function unlinkTaskFromRequirement(req, res, next) {
  try {
    const { id, taskId } = req.params;
    await query(
      'DELETE FROM requirement_tasks WHERE requirement_id = $1 AND task_id = $2',
      [id, taskId]
    );
    res.json({
      success: true,
      message: 'Task unlinked from requirement.',
    });
  } catch (err) {
    next(err);
  }
}


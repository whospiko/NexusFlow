import { query } from '../config/db.js';
import { captureProjectSnapshot } from '../services/versionService.js';
import { logActivity } from '../services/activityService.js';

/**
 * GET /api/projects/:projectId/versions
 * List all version history snapshots for a project
 */
export async function getProjectVersions(req, res, next) {
  try {
    const { projectId } = req.params;

    const sql = `
      SELECT 
        id,
        project_id,
        version_tag,
        title,
        description,
        created_by,
        metrics,
        created_at
      FROM project_versions
      WHERE project_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await query(sql, [projectId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/versions
 * Create an immutable snapshot of the project at the current point in time
 */
export async function createProjectVersion(req, res, next) {
  try {
    const { projectId } = req.params;
    const rawTag = req.body.version_tag || req.body.versionTag;
    const rawTitle = req.body.title;
    const description = req.body.description;
    const author = req.user?.name || req.body.author || 'Piko';

    if (!rawTag || !rawTag.trim()) {
      return res.status(400).json({ success: false, message: 'Version tag is required (e.g. v1.0, v1.1)' });
    }

    // Format tag, e.g. "1.0" -> "v1.0"
    let cleanTag = rawTag.trim();
    if (!cleanTag.startsWith('v') && !cleanTag.startsWith('V')) {
      cleanTag = `v${cleanTag}`;
    }

    const finalTitle = rawTitle && rawTitle.trim() ? rawTitle.trim() : `Snapshot ${cleanTag}`;

    // Check tag uniqueness within project
    const checkRes = await query(
      'SELECT id FROM project_versions WHERE project_id = $1 AND LOWER(version_tag) = LOWER($2)',
      [projectId, cleanTag]
    );
    if (checkRes.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Version tag '${cleanTag}' already exists for this project. Please choose a new version (e.g. v1.1, v2.0).`,
      });
    }

    // Capture complete snapshot data & metrics
    const { snapshotData, metrics } = await captureProjectSnapshot(projectId);

    const insertSql = `
      INSERT INTO project_versions (
        project_id, version_tag, title, description, created_by, snapshot_data, metrics
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, project_id, version_tag, title, description, created_by, metrics, created_at;
    `;

    const result = await query(insertSql, [
      projectId,
      cleanTag,
      finalTitle,
      description ? description.trim() : null,
      author,
      JSON.stringify(snapshotData),
      JSON.stringify(metrics),
    ]);

    res.status(201).json({
      success: true,
      message: `Version snapshot '${cleanTag}' created successfully.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/:projectId/versions/:versionId
 * Inspect full details of a specific version snapshot
 */
export async function getProjectVersionById(req, res, next) {
  try {
    const { projectId, versionId } = req.params;

    const sql = `
      SELECT * FROM project_versions
      WHERE project_id = $1 AND id = $2;
    `;
    const result = await query(sql, [projectId, versionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Version snapshot not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/versions/:versionId/restore
 * Restore or clone project from an immutable snapshot
 */
export async function restoreProjectVersion(req, res, next) {
  try {
    const { projectId, versionId } = req.params;
    const { mode = 'clone', newProjectName, newName, branchName } = req.body;
    const isBranchOrClone = mode === 'clone' || mode === 'branch';
    const userId = req.user?.id || 1;

    // Fetch snapshot
    const snapRes = await query('SELECT * FROM project_versions WHERE project_id = $1 AND id = $2', [projectId, versionId]);
    if (snapRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Version snapshot not found' });
    }
    const versionRecord = snapRes.rows[0];
    const snapshot = versionRecord.snapshot_data;

    if (isBranchOrClone) {
      // Create new cloned project from this snapshot
      const targetName = newName || newProjectName || branchName || `${snapshot.project?.name || 'Project'} (Branch ${versionRecord.version_tag})`;
      
      const createProjRes = await query(
        'INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
        [targetName, snapshot.project?.description || null, userId]
      );
      const newProject = createProjRes.rows[0];

      // Add owner
      await query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [newProject.id, userId, 'owner']
      );

      // Copy other members
      if (Array.isArray(snapshot.members)) {
        for (const m of snapshot.members) {
          if (m.user_id !== userId) {
            await query(
              'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [newProject.id, m.user_id, m.role]
            );
          }
        }
      }

      // Map old task ID -> new task ID
      const taskIdMap = new Map();
      if (Array.isArray(snapshot.tasks)) {
        for (const t of snapshot.tasks) {
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
            t.status,
            t.creator,
            t.assignee,
            t.start_date,
            t.due_date,
            t.estimated_hours,
            t.progress,
          ]);

          const newTid = insertTaskRes.rows[0].id;
          taskIdMap.set(t.id, newTid);

          // Restore tags
          if (Array.isArray(t.tags)) {
            for (const tg of t.tags) {
              await query(
                'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [newTid, tg.id]
              );
            }
          }
        }
      }

      // Restore dependencies with mapped IDs
      if (Array.isArray(snapshot.dependencies)) {
        for (const dep of snapshot.dependencies) {
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

      // Restore requirements and traceability
      if (Array.isArray(snapshot.requirements)) {
        for (const r of snapshot.requirements) {
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
          if (Array.isArray(r.linked_task_ids)) {
            for (const oldTid of r.linked_task_ids) {
              const mappedTid = taskIdMap.get(oldTid);
              if (mappedTid) {
                await query(
                  'INSERT INTO requirement_tasks (requirement_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [newReqId, mappedTid]
                );
              }
            }
          }
        }
      }

      return res.status(201).json({
        success: true,
        message: `Project cloned successfully from version snapshot '${versionRecord.version_tag}'.`,
        data: newProject,
      });
    }

    // Default mode: revert in-place (if requested)
    res.json({
      success: true,
      message: `Version snapshot '${versionRecord.version_tag}' verified for restore.`,
      data: versionRecord,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/projects/:projectId/versions/:versionId
 * Delete a specific version snapshot
 */
export async function deleteProjectVersion(req, res, next) {
  try {
    const { projectId, versionId } = req.params;

    const result = await query(
      'DELETE FROM project_versions WHERE project_id = $1 AND id = $2 RETURNING id, version_tag, title',
      [projectId, versionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Version snapshot not found' });
    }

    res.json({
      success: true,
      message: `Version snapshot '${result.rows[0].version_tag}' deleted.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}


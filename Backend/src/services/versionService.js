import { query } from '../config/db.js';
import * as erdService from './erdService.js';

/**
 * Auto-migration: Ensure project_versions table exists on server startup
 */
export async function ensureVersionTableExists() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS project_versions (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version_tag VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_by VARCHAR(100) NOT NULL,
        snapshot_data JSONB NOT NULL,
        metrics JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_proj_version UNIQUE (project_id, version_tag)
      );

      CREATE INDEX IF NOT EXISTS idx_proj_versions_project_id ON project_versions(project_id);
      CREATE INDEX IF NOT EXISTS idx_proj_versions_tag ON project_versions(version_tag);
    `);
    console.log('✅ project_versions table & indexes verified');
  } catch (err) {
    console.error('⚠️ Could not verify project_versions table:', err.message);
  }
}

/**
 * Capture full immutable snapshot of a project at the current point in time
 */
export async function captureProjectSnapshot(projectId) {
  // 1. Fetch Project
  const projRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  if (projRes.rows.length === 0) {
    throw new Error('Project not found');
  }
  const project = projRes.rows[0];

  // 2. Fetch Requirements with Traceability
  const reqRes = await query(`
    SELECT 
      r.*,
      COALESCE(
        json_agg(rt.task_id) FILTER (WHERE rt.task_id IS NOT NULL),
        '[]'
      ) AS linked_task_ids
    FROM project_requirements r
    LEFT JOIN requirement_tasks rt ON r.id = rt.requirement_id
    WHERE r.project_id = $1
    GROUP BY r.id
    ORDER BY r.id ASC
  `, [projectId]);
  const requirements = reqRes.rows;

  // 3. Fetch Tasks with Tags
  const taskRes = await query(`
    SELECT 
      t.*,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
        ) FILTER (WHERE tg.id IS NOT NULL),
        '[]'
      ) AS tags
    FROM tasks t
    LEFT JOIN task_tags tt ON t.id = tt.task_id
    LEFT JOIN tags tg ON tt.tag_id = tg.id
    WHERE t.project_id = $1
    GROUP BY t.id
    ORDER BY t.id ASC
  `, [projectId]);
  const tasks = taskRes.rows;

  // 4. Fetch Dependencies
  const depRes = await query(`
    SELECT * FROM task_dependencies 
    WHERE project_id = $1 
    ORDER BY id ASC
  `, [projectId]);
  const dependencies = depRes.rows;

  // 5. Fetch Project Members
  const memberRes = await query(`
    SELECT pm.user_id, pm.role, u.name, u.email, u.avatar_url
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = $1
  `, [projectId]);
  const members = memberRes.rows;

  // 6. Fetch ERD Schema (Entities & Relationships)
  const [entities, relationships] = await Promise.all([
    erdService.getProjectEntities(projectId).catch(() => []),
    erdService.getProjectRelationships(projectId).catch(() => []),
  ]);

  // 7. Compute Snapshot Metrics
  const totalReqs = requirements.length;
  const functionalCount = requirements.filter((r) => r.type === 'FR').length;
  const nonFunctionalCount = requirements.filter((r) => r.type === 'NFR').length;
  const coveredCount = requirements.filter((r) => r.linked_task_ids && r.linked_task_ids.length > 0).length;
  const validatedCount = requirements.filter((r) => r.status === 'validated').length;
  const coveragePercentage = totalReqs > 0 ? Math.round((coveredCount / totalReqs) * 100) : 0;
  const validationPercentage = totalReqs > 0 ? Math.round((validatedCount / totalReqs) * 100) : 0;

  const totalTasks = tasks.length;
  const closedTasks = tasks.filter((t) => t.status === 'closed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const openTasks = tasks.filter((t) => t.status === 'open').length;
  const resolvedTasks = tasks.filter((t) => t.status === 'resolved').length;
  const progressPercentage = totalTasks > 0 ? Math.round((closedTasks / totalTasks) * 100) : 0;

  const metrics = {
    totalRequirements: totalReqs,
    functionalCount,
    nonFunctionalCount,
    coveredCount,
    validatedCount,
    coveragePercentage,
    validationPercentage,
    totalTasks,
    closedTasks,
    inProgressTasks,
    openTasks,
    resolvedTasks,
    progressPercentage,
    totalTables: entities.length,
    totalRelationships: relationships.length,
  };

  const snapshotData = {
    captured_at: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    requirements,
    tasks,
    dependencies,
    members,
    entities,
    relationships,
  };

  return { snapshotData, metrics };
}


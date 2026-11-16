import * as schemaVersionService from '../services/schemaVersionService.js';
import { query } from '../config/db.js';

/**
 * GET /api/projects/:projectId/schema/versions
 */
export async function getProjectSchemaVersions(req, res, next) {
  try {
    const { projectId } = req.params;
    const { branch } = req.query;
    const versions = await schemaVersionService.getProjectSchemaVersions(projectId, branch);
    res.json({ success: true, data: versions });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/schema/versions
 */
export async function commitSchemaVersion(req, res, next) {
  try {
    const { projectId } = req.params;
    const { branch, versionTag, title, rationale, description } = req.body;
    const author = req.user?.name || req.body.author || 'Piko';

    const commit = await schemaVersionService.commitSchemaVersion(projectId, {
      branch,
      versionTag,
      title,
      rationale,
      description,
      author,
      parentVersionId: req.body.parentVersionId || null,
    });

    res.status(201).json({ success: true, data: commit });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/:projectId/schema/versions/:versionId
 */
export async function getProjectSchemaVersionById(req, res, next) {
  try {
    const { projectId, versionId } = req.params;
    const result = await query(
      'SELECT * FROM project_versions WHERE project_id = $1 AND id = $2',
      [projectId, versionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schema version not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects/:projectId/schema/branches
 */
export async function getProjectBranches(req, res, next) {
  try {
    const { projectId } = req.params;
    const branches = await schemaVersionService.getProjectBranches(projectId);
    res.json({ success: true, data: branches });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/schema/diff
 * Compare two version snapshots, or a version snapshot vs current live canvas
 */
export async function compareSchemaVersions(req, res, next) {
  try {
    const { projectId } = req.params;
    const { baseVersionId, compareVersionId } = req.body;

    let baseSnapshot = null;
    let compareSnapshot = null;

    // Load base snapshot
    if (baseVersionId === 'current' || !baseVersionId) {
      baseSnapshot = await schemaVersionService.captureSchemaSnapshot(projectId);
    } else {
      const baseRes = await query(
        'SELECT snapshot_data FROM project_versions WHERE project_id = $1 AND id = $2',
        [projectId, baseVersionId]
      );
      if (baseRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Base version not found' });
      }
      baseSnapshot = baseRes.rows[0].snapshot_data;
    }

    // Load compare snapshot
    if (compareVersionId === 'current') {
      compareSnapshot = await schemaVersionService.captureSchemaSnapshot(projectId);
    } else if (compareVersionId) {
      const compRes = await query(
        'SELECT snapshot_data FROM project_versions WHERE project_id = $1 AND id = $2',
        [projectId, compareVersionId]
      );
      if (compRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Compare version not found' });
      }
      compareSnapshot = compRes.rows[0].snapshot_data;
    } else {
      // If no compare specified, compare base against current
      compareSnapshot = await schemaVersionService.captureSchemaSnapshot(projectId);
    }

    const diff = schemaVersionService.compareSchemaSnapshots(baseSnapshot, compareSnapshot);
    res.json({
      success: true,
      data: {
        diff,
        baseSnapshot,
        compareSnapshot,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/schema/migration
 * Generate production-ready ALTER TABLE SQL (UP and DOWN)
 */
export async function generateMigration(req, res, next) {
  try {
    const { projectId } = req.params;
    const { baseVersionId, compareVersionId, includeTransaction = true, title } = req.body;
    const author = req.user?.name || req.body.author || 'Piko';

    let baseSnapshot = null;
    let compareSnapshot = null;

    if (baseVersionId === 'current' || !baseVersionId) {
      baseSnapshot = await schemaVersionService.captureSchemaSnapshot(projectId);
    } else {
      const baseRes = await query(
        'SELECT snapshot_data FROM project_versions WHERE project_id = $1 AND id = $2',
        [projectId, baseVersionId]
      );
      if (baseRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Base version not found' });
      }
      baseSnapshot = baseRes.rows[0].snapshot_data;
    }

    if (compareVersionId === 'current') {
      compareSnapshot = await schemaVersionService.captureSchemaSnapshot(projectId);
    } else if (compareVersionId) {
      const compRes = await query(
        'SELECT snapshot_data FROM project_versions WHERE project_id = $1 AND id = $2',
        [projectId, compareVersionId]
      );
      if (compRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Compare version not found' });
      }
      compareSnapshot = compRes.rows[0].snapshot_data;
    } else {
      compareSnapshot = await schemaVersionService.captureSchemaSnapshot(projectId);
    }

    const migration = schemaVersionService.generateSqlMigration(baseSnapshot, compareSnapshot, {
      includeTransaction,
      author,
      title: title || 'Database Schema Migration',
    });

    res.json({ success: true, data: migration });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/schema/merge
 * 3-way merge between two schema branches / versions
 */
export async function mergeSchemaBranches(req, res, next) {
  try {
    const { projectId } = req.params;
    const { sourceVersionId, targetVersionId, targetBranch = 'main', rationale } = req.body;
    const author = req.user?.name || req.body.author || 'Piko';

    if (!sourceVersionId || !targetVersionId) {
      return res.status(400).json({ success: false, message: 'sourceVersionId and targetVersionId are required' });
    }

    const mergeResult = await schemaVersionService.mergeSchemaBranches(projectId, {
      sourceVersionId,
      targetVersionId,
      targetBranch,
      author,
      rationale,
    });

    res.json({ success: true, data: mergeResult });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:projectId/schema/restore/:versionId
 * Revert the live project schema to an immutable snapshot
 */
export async function restoreSchemaSnapshot(req, res, next) {
  try {
    const { projectId, versionId } = req.params;
    const author = req.user?.name || req.body.author || 'Piko';

    const snapRes = await query(
      'SELECT snapshot_data FROM project_versions WHERE project_id = $1 AND id = $2',
      [projectId, versionId]
    );

    if (snapRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Version snapshot not found' });
    }

    const snapshotData = snapRes.rows[0].snapshot_data;
    const result = await schemaVersionService.restoreSchemaToProject(projectId, snapshotData, author);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}


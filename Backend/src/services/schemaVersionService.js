import { query, pool } from '../config/db.js';
import crypto from 'crypto';
import * as erdService from './erdService.js';
import { broadcastErdUpdate } from './socketService.js';

/**
 * Auto-migration: Ensure schema versioning columns and tables exist
 */
export async function ensureSchemaVersionTablesExist() {
  try {
    await query(`
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS branch VARCHAR(100) NOT NULL DEFAULT 'main';
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS commit_hash VARCHAR(40);
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS parent_version_id INTEGER REFERENCES project_versions(id) ON DELETE SET NULL;
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS rationale TEXT;
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS version_type VARCHAR(50) DEFAULT 'schema';

      -- Remove strict global tag uniqueness so multiple commits on branches work seamlessly
      ALTER TABLE project_versions DROP CONSTRAINT IF EXISTS uq_proj_version;

      CREATE INDEX IF NOT EXISTS idx_proj_versions_branch ON project_versions(project_id, branch);
      CREATE INDEX IF NOT EXISTS idx_proj_versions_hash ON project_versions(commit_hash);
      CREATE INDEX IF NOT EXISTS idx_proj_versions_parent ON project_versions(parent_version_id);
    `);
    console.log('✅ Schema versioning (Git for databases) tables & columns verified');
  } catch (err) {
    console.error('⚠️ Could not verify schema versioning columns:', err.message);
  }
}

/**
 * Capture full normalized schema snapshot for a project
 */
export async function captureSchemaSnapshot(projectId) {
  // Fetch entities with attributes and positions
  const entities = await erdService.getProjectEntities(projectId);
  const relationships = await erdService.getProjectRelationships(projectId);

  // Position coordinates map joined with entity names for robust cross-version mapping
  const posRes = await query(`
    SELECT p.entity_id, e.name AS entity_name, p.x, p.y
    FROM erd_node_positions p
    LEFT JOIN erd_entities e ON p.entity_id = e.id
    WHERE p.project_id = $1
  `, [projectId]);

  const positions = posRes.rows.map((r) => ({
    entityId: r.entity_id,
    entityName: r.entity_name || '',
    x: r.x,
    y: r.y,
  }));

  // Clean and normalize entity representation for deterministic diffs
  const normalizedEntities = entities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    pos_x: e.pos_x ?? 100,
    pos_y: e.pos_y ?? 100,
    description: e.description || '',
    attributes: (e.attributes || []).map((a) => ({
      name: a.name,
      dataType: a.dataType,
      keyType: a.keyType,
      isNullable: !!a.isNullable,
      defaultValue: a.defaultValue || null,
      refEntityName: a.refEntityName || null,
      description: a.description || '',
    })),
  }));

  const normalizedRelationships = relationships.map((r) => ({
    id: r.id,
    sourceEntityName: r.source_entity_name || r.sourceEntityName,
    targetEntityName: r.target_entity_name || r.targetEntityName,
    cardinality: r.cardinality,
    name: r.name,
    description: r.description || '',
    isIdentifying: !!r.is_identifying,
    onDelete: r.on_delete || 'CASCADE',
  }));

  // Summary Metrics
  const totalTables = normalizedEntities.length;
  let totalColumns = 0;
  let totalPks = 0;
  let totalFks = 0;

  normalizedEntities.forEach((e) => {
    totalColumns += e.attributes.length;
    e.attributes.forEach((a) => {
      if (a.keyType === 'PK' || a.keyType === 'Composite') totalPks++;
      if (a.keyType === 'FK') totalFks++;
    });
  });

  return {
    schemaVersion: '1.0',
    captured_at: new Date().toISOString(),
    projectId: parseInt(projectId, 10),
    entities: normalizedEntities,
    relationships: normalizedRelationships,
    positions,
    metrics: {
      totalTables,
      totalColumns,
      totalRelationships: normalizedRelationships.length,
      totalPks,
      totalFks,
    },
  };
}

/**
 * List schema versions / commits for a project (optionally filtered by branch)
 */
export async function getProjectSchemaVersions(projectId, branch = null) {
  let sql = `
    SELECT 
      id,
      project_id,
      version_tag,
      title,
      description,
      rationale,
      branch,
      commit_hash,
      parent_version_id,
      version_type,
      created_by,
      metrics,
      created_at,
      CASE 
        WHEN snapshot_data->'entities' IS NOT NULL AND jsonb_array_length(COALESCE(snapshot_data->'entities', '[]'::jsonb)) > 0 
        THEN true 
        ELSE false 
      END AS has_schema
    FROM project_versions
    WHERE project_id = $1
  `;
  const params = [projectId];

  if (branch) {
    sql += ` AND branch = $2`;
    params.push(branch);
  }

  sql += ` ORDER BY created_at DESC;`;

  const result = await query(sql, params);
  return result.rows;
}

/**
 * List distinct active branches for a project
 */
export async function getProjectBranches(projectId) {
  const sql = `
    SELECT DISTINCT branch
    FROM project_versions
    WHERE project_id = $1
    ORDER BY branch ASC;
  `;
  const result = await query(sql, [projectId]);
  const branches = result.rows.map((r) => r.branch).filter(Boolean);
  if (!branches.includes('main')) {
    branches.unshift('main');
  }
  return branches;
}

/**
 * Commit a new schema snapshot (like a Git commit)
 */
export async function commitSchemaVersion(projectId, {
  branch = 'main',
  versionTag = null,
  title,
  rationale,
  description,
  author = 'Piko',
  parentVersionId = null,
}) {
  const snapshotData = await captureSchemaSnapshot(projectId);

  // Generate Git-like commit hash
  const hashPayload = `${projectId}-${branch}-${Date.now()}-${Math.random()}`;
  const commitHash = crypto.createHash('sha1').update(hashPayload).digest('hex').substring(0, 8);

  const cleanBranch = (branch || 'main').trim().toLowerCase().replace(/\s+/g, '-');
  const cleanTitle = (title && title.trim()) || `Schema update on ${cleanBranch} [${commitHash}]`;
  const cleanRationale = (rationale && rationale.trim()) || (description && description.trim()) || 'Schema modification commit';

  // Format version tag if provided, e.g. "1.1" -> "v1.1"
  let cleanTag = null;
  if (versionTag && versionTag.trim()) {
    cleanTag = versionTag.trim();
    if (!cleanTag.startsWith('v') && !cleanTag.startsWith('V')) {
      cleanTag = `v${cleanTag}`;
    }
  } else {
    cleanTag = `c-${commitHash}`;
  }

  const insertSql = `
    INSERT INTO project_versions (
      project_id, version_tag, title, description, rationale,
      branch, commit_hash, parent_version_id, version_type,
      created_by, snapshot_data, metrics
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'schema', $9, $10, $11)
    RETURNING *;
  `;

  const result = await query(insertSql, [
    projectId,
    cleanTag,
    cleanTitle,
    description || cleanRationale,
    cleanRationale,
    cleanBranch,
    commitHash,
    parentVersionId,
    author,
    JSON.stringify(snapshotData),
    JSON.stringify(snapshotData.metrics),
  ]);

  broadcastErdUpdate(projectId, 'erd:schema-committed', {
    version: result.rows[0],
    actor: author,
  });

  return result.rows[0];
}

/**
 * Visual & Semantic Diff between two schema snapshots
 */
export function compareSchemaSnapshots(oldSnapshot, newSnapshot) {
  const oldEntities = (oldSnapshot && oldSnapshot.entities) || [];
  const newEntities = (newSnapshot && newSnapshot.entities) || [];

  const oldEntityMap = new Map(oldEntities.map((e) => [e.name.toLowerCase(), e]));
  const newEntityMap = new Map(newEntities.map((e) => [e.name.toLowerCase(), e]));

  const addedEntities = [];
  const removedEntities = [];
  const modifiedEntities = [];

  // 1. Detect Added and Modified Entities
  newEntities.forEach((newE) => {
    const oldE = oldEntityMap.get(newE.name.toLowerCase());
    if (!oldE) {
      addedEntities.push({
        name: newE.name,
        type: newE.type,
        attributeCount: newE.attributes.length,
        attributes: newE.attributes,
      });
    } else {
      // Check for attribute differences
      const oldAttrMap = new Map((oldE.attributes || []).map((a) => [a.name.toLowerCase(), a]));
      const newAttrMap = new Map((newE.attributes || []).map((a) => [a.name.toLowerCase(), a]));

      const addedAttrs = [];
      const removedAttrs = [];
      const modifiedAttrs = [];

      (newE.attributes || []).forEach((newAttr) => {
        const oldAttr = oldAttrMap.get(newAttr.name.toLowerCase());
        if (!oldAttr) {
          addedAttrs.push(newAttr);
        } else {
          // Compare types, nullability, defaults, key types
          const changes = [];
          if (newAttr.dataType !== oldAttr.dataType) {
            changes.push(`type changed from ${oldAttr.dataType} to ${newAttr.dataType}`);
          }
          if (newAttr.isNullable !== oldAttr.isNullable) {
            changes.push(newAttr.isNullable ? 'changed to nullable' : 'changed to NOT NULL');
          }
          if (newAttr.keyType !== oldAttr.keyType) {
            changes.push(`key changed from ${oldAttr.keyType} to ${newAttr.keyType}`);
          }
          if (newAttr.defaultValue !== oldAttr.defaultValue) {
            changes.push(`default changed from '${oldAttr.defaultValue}' to '${newAttr.defaultValue}'`);
          }

          if (changes.length > 0) {
            modifiedAttrs.push({
              name: newAttr.name,
              oldAttr,
              newAttr,
              changes,
            });
          }
        }
      });

      (oldE.attributes || []).forEach((oldAttr) => {
        if (!newAttrMap.has(oldAttr.name.toLowerCase())) {
          removedAttrs.push(oldAttr);
        }
      });

      if (addedAttrs.length > 0 || removedAttrs.length > 0 || modifiedAttrs.length > 0 || oldE.type !== newE.type) {
        modifiedEntities.push({
          name: newE.name,
          oldType: oldE.type,
          newType: newE.type,
          typeChanged: oldE.type !== newE.type,
          addedAttrs,
          removedAttrs,
          modifiedAttrs,
        });
      }
    }
  });

  // 2. Detect Removed Entities
  oldEntities.forEach((oldE) => {
    if (!newEntityMap.has(oldE.name.toLowerCase())) {
      removedEntities.push({
        name: oldE.name,
        type: oldE.type,
        attributeCount: (oldE.attributes || []).length,
      });
    }
  });

  // 3. Compare Relationships
  const oldRels = (oldSnapshot && oldSnapshot.relationships) || [];
  const newRels = (newSnapshot && newSnapshot.relationships) || [];

  const relKey = (r) => `${(r.sourceEntityName || '').toLowerCase()}-${(r.targetEntityName || '').toLowerCase()}-${r.cardinality}`;

  const oldRelMap = new Map(oldRels.map((r) => [relKey(r), r]));
  const newRelMap = new Map(newRels.map((r) => [relKey(r), r]));

  const addedRels = [];
  const removedRels = [];

  newRels.forEach((r) => {
    if (!oldRelMap.has(relKey(r))) {
      addedRels.push(r);
    }
  });

  oldRels.forEach((r) => {
    if (!newRelMap.has(relKey(r))) {
      removedRels.push(r);
    }
  });

  // 4. Build Human-Readable Changelog Summary
  const summaryParts = [];

  addedEntities.forEach((e) => {
    summaryParts.push(`Added table ${e.name.toUpperCase()}`);
  });

  removedEntities.forEach((e) => {
    summaryParts.push(`Removed table ${e.name.toUpperCase()}`);
  });

  modifiedEntities.forEach((m) => {
    m.addedAttrs.forEach((a) => {
      summaryParts.push(`Added ${a.name} to ${m.name.toUpperCase()}`);
    });
    m.removedAttrs.forEach((a) => {
      summaryParts.push(`Removed ${a.name} from ${m.name.toUpperCase()}`);
    });
    m.modifiedAttrs.forEach((ma) => {
      summaryParts.push(`Modified ${ma.name} in ${m.name.toUpperCase()} (${ma.changes.join(', ')})`);
    });
  });

  addedRels.forEach((r) => {
    summaryParts.push(`Added relation ${r.sourceEntityName} (${r.cardinality}) ${r.targetEntityName}`);
  });

  removedRels.forEach((r) => {
    summaryParts.push(`Removed relation ${r.sourceEntityName} -> ${r.targetEntityName}`);
  });

  const changelogText = summaryParts.length > 0 ? summaryParts.join('; ') : 'No schema changes detected';

  const hasChanges =
    addedEntities.length > 0 ||
    removedEntities.length > 0 ||
    modifiedEntities.length > 0 ||
    addedRels.length > 0 ||
    removedRels.length > 0;

  return {
    hasChanges,
    changelogText,
    summaryParts,
    entities: {
      added: addedEntities,
      removed: removedEntities,
      modified: modifiedEntities,
    },
    relationships: {
      added: addedRels,
      removed: removedRels,
    },
    metricsDiff: {
      tableDiff: newEntities.length - oldEntities.length,
      relDiff: newRels.length - oldRels.length,
    },
  };
}

/**
 * Generate Production-Ready PostgreSQL ALTER TABLE SQL Migrations (UP and DOWN)
 */
export function generateSqlMigration(oldSnapshot, newSnapshot, options = {}) {
  const { includeTransaction = true, author = 'Piko', title = 'Schema Migration' } = options;
  const diff = compareSchemaSnapshots(oldSnapshot, newSnapshot);

  const timestamp = new Date().toISOString();
  const upLines = [];
  const downLines = [];
  const warnings = [];

  // Header comment
  upLines.push(`-- ====================================================================`);
  upLines.push(`-- Auto-Generated Migration: UP`);
  upLines.push(`-- Title: ${title}`);
  upLines.push(`-- Author: ${author}`);
  upLines.push(`-- Date: ${timestamp}`);
  upLines.push(`-- Summary: ${diff.changelogText}`);
  upLines.push(`-- ====================================================================\n`);

  downLines.push(`-- ====================================================================`);
  downLines.push(`-- Auto-Generated Migration: DOWN (Rollback)`);
  downLines.push(`-- Title: Rollback ${title}`);
  downLines.push(`-- Date: ${timestamp}`);
  downLines.push(`-- ====================================================================\n`);

  if (includeTransaction) {
    upLines.push(`BEGIN;\n`);
    downLines.push(`BEGIN;\n`);
  }

  // 1. ADD NEW TABLES
  diff.entities.added.forEach((e) => {
    upLines.push(`-- 1. Create table: ${e.name}`);
    upLines.push(`CREATE TABLE IF NOT EXISTS "${e.name}" (`);
    const colDefs = (e.attributes || []).map((a) => {
      let def = `  "${a.name}" ${mapDataTypeToSql(a.dataType)}`;
      if (a.keyType === 'PK') def += ` PRIMARY KEY`;
      if (!a.isNullable && a.keyType !== 'PK') def += ` NOT NULL`;
      if (a.defaultValue) def += ` DEFAULT ${formatDefaultValue(a.defaultValue, a.dataType)}`;
      return def;
    });

    if (colDefs.length === 0) {
      colDefs.push(`  "id" SERIAL PRIMARY KEY`);
    }

    upLines.push(colDefs.join(',\n'));
    upLines.push(`);\n`);

    // Down rollback drops the new table
    downLines.push(`DROP TABLE IF EXISTS "${e.name}" CASCADE;`);
  });

  // 2. DROP REMOVED TABLES
  diff.entities.removed.forEach((e) => {
    warnings.push(`Dropping table '${e.name}' will permanently delete table structure and data.`);
    upLines.push(`-- ⚠️ WARNING: Destructive table drop`);
    upLines.push(`DROP TABLE IF EXISTS "${e.name}" CASCADE;\n`);

    // Down rollback re-creates dropped table
    const oldE = oldSnapshot.entities.find((x) => x.name.toLowerCase() === e.name.toLowerCase());
    if (oldE) {
      downLines.push(`-- Rollback: Re-create dropped table ${oldE.name}`);
      downLines.push(`CREATE TABLE IF NOT EXISTS "${oldE.name}" (`);
      const colDefs = (oldE.attributes || []).map((a) => {
        let def = `  "${a.name}" ${mapDataTypeToSql(a.dataType)}`;
        if (a.keyType === 'PK') def += ` PRIMARY KEY`;
        if (!a.isNullable && a.keyType !== 'PK') def += ` NOT NULL`;
        return def;
      });
      downLines.push(colDefs.join(',\n'));
      downLines.push(`);\n`);
    }
  });

  // 3. ALTER EXISTING TABLES
  diff.entities.modified.forEach((m) => {
    upLines.push(`-- Modify table: ${m.name}`);

    // Added columns
    m.addedAttrs.forEach((a) => {
      let stmt = `ALTER TABLE "${m.name}" ADD COLUMN IF NOT EXISTS "${a.name}" ${mapDataTypeToSql(a.dataType)}`;
      if (!a.isNullable) {
        if (a.defaultValue) {
          stmt += ` NOT NULL DEFAULT ${formatDefaultValue(a.defaultValue, a.dataType)}`;
        } else {
          // If no default, caution with NOT NULL
          warnings.push(`Adding NOT NULL column '${a.name}' to table '${m.name}' without default may fail if rows exist.`);
          stmt += ` DEFAULT ''`;
        }
      } else if (a.defaultValue) {
        stmt += ` DEFAULT ${formatDefaultValue(a.defaultValue, a.dataType)}`;
      }
      upLines.push(`${stmt};`);

      // Down: drop added column
      downLines.push(`ALTER TABLE "${m.name}" DROP COLUMN IF EXISTS "${a.name}" CASCADE;`);
    });

    // Removed columns
    m.removedAttrs.forEach((a) => {
      warnings.push(`Dropping column '${a.name}' from '${m.name}' causes permanent data loss.`);
      upLines.push(`-- ⚠️ WARNING: Destructive column drop`);
      upLines.push(`ALTER TABLE "${m.name}" DROP COLUMN IF EXISTS "${a.name}" CASCADE;`);

      // Down: re-add dropped column
      downLines.push(`ALTER TABLE "${m.name}" ADD COLUMN IF NOT EXISTS "${a.name}" ${mapDataTypeToSql(a.dataType)};`);
    });

    // Modified columns
    m.modifiedAttrs.forEach((ma) => {
      const sqlColType = mapDataTypeToSql(ma.newAttr.dataType);
      upLines.push(`-- Column ${ma.name} modification`);
      upLines.push(`ALTER TABLE "${m.name}" ALTER COLUMN "${ma.name}" TYPE ${sqlColType} USING "${ma.name}"::${sqlColType};`);

      if (ma.newAttr.isNullable !== ma.oldAttr.isNullable) {
        if (ma.newAttr.isNullable) {
          upLines.push(`ALTER TABLE "${m.name}" ALTER COLUMN "${ma.name}" DROP NOT NULL;`);
        } else {
          upLines.push(`ALTER TABLE "${m.name}" ALTER COLUMN "${ma.name}" SET NOT NULL;`);
        }
      }

      if (ma.newAttr.defaultValue !== ma.oldAttr.defaultValue) {
        if (ma.newAttr.defaultValue) {
          upLines.push(`ALTER TABLE "${m.name}" ALTER COLUMN "${ma.name}" SET DEFAULT ${formatDefaultValue(ma.newAttr.defaultValue, ma.newAttr.dataType)};`);
        } else {
          upLines.push(`ALTER TABLE "${m.name}" ALTER COLUMN "${ma.name}" DROP DEFAULT;`);
        }
      }

      // Down: revert column type
      const oldColType = mapDataTypeToSql(ma.oldAttr.dataType);
      downLines.push(`ALTER TABLE "${m.name}" ALTER COLUMN "${ma.name}" TYPE ${oldColType} USING "${ma.name}"::${oldColType};`);
    });

    upLines.push('');
  });

  // 4. RELATIONSHIPS / FOREIGN KEYS
  diff.relationships.added.forEach((r) => {
    const constraintName = `fk_${r.sourceEntityName.toLowerCase()}_${r.targetEntityName.toLowerCase()}`;
    const fkCol = `${r.targetEntityName.toLowerCase()}_id`;
    upLines.push(`-- Add foreign key constraint`);
    upLines.push(`DO $$ BEGIN`);
    upLines.push(`  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') THEN`);
    upLines.push(`    ALTER TABLE "${r.sourceEntityName}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("${fkCol}") REFERENCES "${r.targetEntityName}"("id") ON DELETE ${r.onDelete || 'CASCADE'};`);
    upLines.push(`  END IF;`);
    upLines.push(`END $$;\n`);

    downLines.push(`ALTER TABLE "${r.sourceEntityName}" DROP CONSTRAINT IF EXISTS "${constraintName}";`);
  });

  diff.relationships.removed.forEach((r) => {
    const constraintName = `fk_${r.sourceEntityName.toLowerCase()}_${r.targetEntityName.toLowerCase()}`;
    upLines.push(`ALTER TABLE "${r.sourceEntityName}" DROP CONSTRAINT IF EXISTS "${constraintName}";\n`);
  });

  if (includeTransaction) {
    upLines.push(`COMMIT;`);
    downLines.push(`COMMIT;`);
  }

  return {
    upSql: upLines.join('\n'),
    downSql: downLines.join('\n'),
    warnings,
    diff,
    timestamp,
  };
}

/**
 * 3-Way Schema Merge Algorithm (like Git merge)
 */
export async function mergeSchemaBranches(projectId, {
  sourceVersionId,
  targetVersionId,
  targetBranch = 'main',
  author = 'Piko',
  rationale = 'Merge database branches',
}) {
  // Fetch snapshots
  const [sourceRes, targetRes] = await Promise.all([
    query('SELECT * FROM project_versions WHERE id = $1 AND project_id = $2', [sourceVersionId, projectId]),
    query('SELECT * FROM project_versions WHERE id = $1 AND project_id = $2', [targetVersionId, projectId]),
  ]);

  if (sourceRes.rows.length === 0 || targetRes.rows.length === 0) {
    throw new Error('Source or Target version snapshot not found');
  }

  const sourceSnap = sourceRes.rows[0].snapshot_data;
  const targetSnap = targetRes.rows[0].snapshot_data;

  const conflicts = [];
  const mergedEntities = [];
  const targetEntityMap = new Map((targetSnap.entities || []).map((e) => [e.name.toLowerCase(), e]));
  const sourceEntityMap = new Map((sourceSnap.entities || []).map((e) => [e.name.toLowerCase(), e]));

  // Process all entities from target branch
  targetSnap.entities.forEach((targetE) => {
    const sourceE = sourceEntityMap.get(targetE.name.toLowerCase());
    if (!sourceE) {
      // Exists in target, not in source -> keep target
      mergedEntities.push(targetE);
    } else {
      // Exists in both: merge columns
      const mergedAttrs = [];
      const sourceAttrMap = new Map((sourceE.attributes || []).map((a) => [a.name.toLowerCase(), a]));

      targetE.attributes.forEach((tAttr) => {
        const sAttr = sourceAttrMap.get(tAttr.name.toLowerCase());
        if (!sAttr) {
          mergedAttrs.push(tAttr);
        } else {
          // Check for attribute conflicts (e.g. conflicting data types)
          if (tAttr.dataType !== sAttr.dataType) {
            conflicts.push({
              type: 'TYPE_MISMATCH',
              tableName: targetE.name,
              attributeName: tAttr.name,
              targetValue: tAttr.dataType,
              sourceValue: sAttr.dataType,
              resolutionHint: `Conflict on ${targetE.name}.${tAttr.name}: Target is '${tAttr.dataType}', Source is '${sAttr.dataType}'`,
            });
          }
          // Default to source or target
          mergedAttrs.push(tAttr);
        }
      });

      // Add columns that only existed in source
      sourceE.attributes.forEach((sAttr) => {
        const existsInTarget = targetE.attributes.some((ta) => ta.name.toLowerCase() === sAttr.name.toLowerCase());
        if (!existsInTarget) {
          mergedAttrs.push(sAttr);
        }
      });

      mergedEntities.push({
        ...targetE,
        attributes: mergedAttrs,
      });
    }
  });

  // Add tables that only existed in source
  sourceSnap.entities.forEach((sourceE) => {
    if (!targetEntityMap.has(sourceE.name.toLowerCase())) {
      mergedEntities.push(sourceE);
    }
  });

  // Merge relationships
  const relKey = (r) => `${(r.sourceEntityName || '').toLowerCase()}-${(r.targetEntityName || '').toLowerCase()}-${r.cardinality}`;
  const mergedRelMap = new Map();

  (targetSnap.relationships || []).forEach((r) => mergedRelMap.set(relKey(r), r));
  (sourceSnap.relationships || []).forEach((r) => mergedRelMap.set(relKey(r), r));

  const mergedRelationships = Array.from(mergedRelMap.values());

  const hasConflicts = conflicts.length > 0;

  if (hasConflicts) {
    return {
      success: false,
      hasConflicts: true,
      conflicts,
      message: `Merge conflict detected across ${conflicts.length} fields. Please review and resolve.`,
    };
  }

  // Create merged snapshot
  const mergedSnapshot = {
    schemaVersion: '1.0',
    captured_at: new Date().toISOString(),
    projectId: parseInt(projectId, 10),
    entities: mergedEntities,
    relationships: mergedRelationships,
    positions: targetSnap.positions || sourceSnap.positions || [],
    metrics: {
      totalTables: mergedEntities.length,
      totalColumns: mergedEntities.reduce((sum, e) => sum + e.attributes.length, 0),
      totalRelationships: mergedRelationships.length,
    },
  };

  // Commit the merge
  const commit = await commitSchemaVersion(projectId, {
    branch: targetBranch,
    title: `Merge commit: '${sourceRes.rows[0].branch || 'source'}' into '${targetBranch}'`,
    rationale: rationale || `Merged version ${sourceRes.rows[0].version_tag} into ${targetRes.rows[0].version_tag}`,
    author,
    parentVersionId: targetVersionId,
  });

  return {
    success: true,
    hasConflicts: false,
    mergedCommit: commit,
    mergedSnapshot,
  };
}

/**
 * Revert / Restore project schema to a given snapshot
 */
export async function restoreSchemaToProject(projectId, snapshotData, actor = 'Piko') {
  if (!snapshotData || !Array.isArray(snapshotData.entities) || snapshotData.entities.length === 0) {
    throw new Error('This version snapshot does not contain database schema tables (it may be a task-only snapshot). Reverting is canceled to protect your current ERD schema.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear existing relationships, node positions, and entities for this project
    await client.query('DELETE FROM erd_relationships WHERE project_id = $1', [projectId]);
    await client.query('DELETE FROM erd_node_positions WHERE project_id = $1', [projectId]);
    await client.query('DELETE FROM erd_entities WHERE project_id = $1', [projectId]);

    const entityNameMap = new Map(); // entityName.toLowerCase() -> newEntityId
    const oldIdToNewIdMap = new Map(); // oldEntityId -> newEntityId

    // 2. Insert entities
    for (const e of snapshotData.entities || []) {
      const entRes = await client.query(
        `INSERT INTO erd_entities (project_id, name, type, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [projectId, e.name, e.type || 'Strong', e.description || null]
      );
      const newEntityId = entRes.rows[0].id;
      entityNameMap.set(e.name.toLowerCase(), newEntityId);
      if (e.id) {
        oldIdToNewIdMap.set(e.id, newEntityId);
        oldIdToNewIdMap.set(Number(e.id), newEntityId);
        oldIdToNewIdMap.set(String(e.id), newEntityId);
      }

      // Insert attributes
      if (Array.isArray(e.attributes)) {
        for (let idx = 0; idx < e.attributes.length; idx++) {
          const a = e.attributes[idx];
          await client.query(
            `INSERT INTO erd_attributes (
               entity_id, name, data_type, key_type, is_nullable, default_value, order_index, description
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
            [
              newEntityId,
              a.name,
              a.dataType || 'String',
              a.keyType || 'Normal',
              !!a.isNullable,
              a.defaultValue || null,
              idx,
              a.description || null,
            ]
          );
        }
      }
    }

    // 3. Insert relationships with safely mapped entity IDs
    for (const r of snapshotData.relationships || []) {
      const srcName = (r.sourceEntityName || r.source_entity_name || '').toLowerCase();
      const tgtName = (r.targetEntityName || r.target_entity_name || '').toLowerCase();

      let srcId = entityNameMap.get(srcName);
      let tgtId = entityNameMap.get(tgtName);

      if (!srcId && r.source_entity_id) {
        srcId = oldIdToNewIdMap.get(r.source_entity_id) || oldIdToNewIdMap.get(Number(r.source_entity_id));
      }
      if (!tgtId && r.target_entity_id) {
        tgtId = oldIdToNewIdMap.get(r.target_entity_id) || oldIdToNewIdMap.get(Number(r.target_entity_id));
      }

      // Only insert if both source and target entities exist in the newly created entities
      if (srcId && tgtId) {
        await client.query(
          `INSERT INTO erd_relationships (
             project_id, source_entity_id, target_entity_id, cardinality, name, description, is_identifying, on_delete
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            projectId,
            srcId,
            tgtId,
            r.cardinality || '1:M',
            r.name || 'relates to',
            r.description || null,
            !!r.isIdentifying,
            r.onDelete || 'CASCADE',
          ]
        );
      }
    }

    // 4. Restore node positions with mapped entity IDs only (prevents FK violation 23503)
    const positionedEntityIds = new Set();

    for (const p of snapshotData.positions || []) {
      let targetEntityId = null;
      if (p.entityName) {
        targetEntityId = entityNameMap.get(p.entityName.toLowerCase());
      }
      if (!targetEntityId && p.entityId) {
        targetEntityId = oldIdToNewIdMap.get(p.entityId) || oldIdToNewIdMap.get(Number(p.entityId));
      }

      // ONLY insert if targetEntityId points to a valid newly created entity in this project
      if (targetEntityId) {
        await client.query(
          `INSERT INTO erd_node_positions (project_id, entity_id, x, y)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id, entity_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y;`,
          [projectId, targetEntityId, p.x || 100, p.y || 100]
        );
        positionedEntityIds.add(targetEntityId);
      }
    }

    // Fallback: Ensure every newly inserted entity has a node position record
    let autoOffsetX = 100;
    let autoOffsetY = 100;
    for (const e of snapshotData.entities || []) {
      const newEntityId = entityNameMap.get(e.name.toLowerCase());
      if (newEntityId && !positionedEntityIds.has(newEntityId)) {
        await client.query(
          `INSERT INTO erd_node_positions (project_id, entity_id, x, y)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id, entity_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y;`,
          [projectId, newEntityId, e.pos_x || autoOffsetX, e.pos_y || autoOffsetY]
        );
        positionedEntityIds.add(newEntityId);
        autoOffsetX += 280;
        if (autoOffsetX > 900) {
          autoOffsetX = 100;
          autoOffsetY += 240;
        }
      }
    }

    await client.query('COMMIT');

    broadcastErdUpdate(projectId, 'erd:schema-restored', {
      actor,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: `Schema successfully restored! Recovered ${snapshotData.entities.length} tables and ${snapshotData.relationships?.length || 0} relationships.`,
      tableCount: snapshotData.entities.length,
      relationshipCount: snapshotData.relationships?.length || 0,
      tables: Array.from(entityNameMap.keys()),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Helpers
function mapDataTypeToSql(dataType) {
  const dt = (dataType || 'String').toLowerCase();
  switch (dt) {
    case 'int':
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'float':
    case 'double':
      return 'DOUBLE PRECISION';
    case 'decimal':
      return 'NUMERIC(15, 2)';
    case 'boolean':
    case 'bool':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
    case 'timestamp':
      return 'TIMESTAMP WITH TIME ZONE';
    case 'json':
    case 'jsonb':
      return 'JSONB';
    case 'text':
      return 'TEXT';
    case 'string':
    case 'varchar':
    default:
      return 'VARCHAR(255)';
  }
}

function formatDefaultValue(val, dataType) {
  if (val === null || val === undefined || val === '') return 'NULL';
  const dt = (dataType || '').toLowerCase();
  if (dt === 'int' || dt === 'integer' || dt === 'bigint' || dt === 'float' || dt === 'decimal') {
    return isNaN(Number(val)) ? '0' : val;
  }
  if (dt === 'boolean' || dt === 'bool') {
    return val === 'true' || val === true ? 'TRUE' : 'FALSE';
  }
  if (val.toUpperCase() === 'CURRENT_TIMESTAMP' || val.toUpperCase() === 'NOW()') {
    return 'CURRENT_TIMESTAMP';
  }
  return `'${val.replace(/'/g, "''")}'`;
}


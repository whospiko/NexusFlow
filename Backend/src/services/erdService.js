import { query } from '../config/db.js';

/**
 * Pure SQL Auto-Migration: Ensure ERD tables exist on boot
 */
export async function ensureErdTablesExist() {
  try {
    await query(`
      -- ERD Entities Table (Strong / Weak)
      CREATE TABLE IF NOT EXISTS erd_entities (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'Strong' CHECK (type IN ('Strong', 'Weak')),
        description TEXT,
        parent_entity_id INTEGER REFERENCES erd_entities(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_proj_entity_name UNIQUE (project_id, name)
      );

      -- ERD Attributes Table
      CREATE TABLE IF NOT EXISTS erd_attributes (
        id SERIAL PRIMARY KEY,
        entity_id INTEGER NOT NULL REFERENCES erd_entities(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        data_type VARCHAR(50) NOT NULL DEFAULT 'String',
        key_type VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (key_type IN ('PK', 'FK', 'Normal', 'Composite')),
        is_nullable BOOLEAN NOT NULL DEFAULT false,
        default_value TEXT,
        ref_entity_id INTEGER REFERENCES erd_entities(id) ON DELETE SET NULL,
        ref_attribute_id INTEGER REFERENCES erd_attributes(id) ON DELETE SET NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_entity_attr_name UNIQUE (entity_id, name)
      );

      -- ERD Relationships Table
      CREATE TABLE IF NOT EXISTS erd_relationships (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_entity_id INTEGER NOT NULL REFERENCES erd_entities(id) ON DELETE CASCADE,
        target_entity_id INTEGER NOT NULL REFERENCES erd_entities(id) ON DELETE CASCADE,
        cardinality VARCHAR(20) NOT NULL DEFAULT '1:M' CHECK (cardinality IN ('1:1', '1:M', 'M:N')),
        name VARCHAR(100) NOT NULL DEFAULT 'relates to',
        description TEXT,
        is_identifying BOOLEAN NOT NULL DEFAULT false,
        on_delete VARCHAR(20) NOT NULL DEFAULT 'CASCADE' CHECK (on_delete IN ('CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION')),
        junction_entity_id INTEGER REFERENCES erd_entities(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- ERD Canvas Node Positions Table
      CREATE TABLE IF NOT EXISTS erd_node_positions (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        entity_id INTEGER NOT NULL REFERENCES erd_entities(id) ON DELETE CASCADE,
        x DOUBLE PRECISION NOT NULL DEFAULT 100,
        y DOUBLE PRECISION NOT NULL DEFAULT 100,
        CONSTRAINT uq_proj_entity_pos UNIQUE (project_id, entity_id)
      );

      -- Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_erd_entities_project_id ON erd_entities(project_id);
      CREATE INDEX IF NOT EXISTS idx_erd_attrs_entity_id ON erd_attributes(entity_id);
      CREATE INDEX IF NOT EXISTS idx_erd_rels_project_id ON erd_relationships(project_id);
      CREATE INDEX IF NOT EXISTS idx_erd_rels_source ON erd_relationships(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_erd_rels_target ON erd_relationships(target_entity_id);
      CREATE INDEX IF NOT EXISTS idx_erd_positions_project_id ON erd_node_positions(project_id);
    `);
    console.log('✅ ERD Modeling tables & indexes verified (Raw SQL)');
  } catch (err) {
    console.error('⚠️ Could not verify ERD tables:', err.message);
  }
}

/**
 * Fetch all entities for a project with their attributes and positions
 */
export async function getProjectEntities(projectId) {
  const entitiesRes = await query(`
    SELECT 
      e.*,
      p.x AS pos_x,
      p.y AS pos_y,
      COALESCE(
        json_agg(
          json_build_object(
            'id', a.id,
            'name', a.name,
            'dataType', a.data_type,
            'keyType', a.key_type,
            'isNullable', a.is_nullable,
            'defaultValue', a.default_value,
            'refEntityId', a.ref_entity_id,
            'refAttributeId', a.ref_attribute_id,
            'order', a.order_index,
            'description', a.description,
            'isPII', a.is_pii,
            'piiType', a.pii_type,
            'retentionDays', a.retention_days,
            'complianceNotes', a.compliance_notes
          ) ORDER BY a.order_index ASC, a.id ASC
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS attributes
    FROM erd_entities e
    LEFT JOIN erd_node_positions p ON e.id = p.entity_id AND p.project_id = e.project_id
    LEFT JOIN erd_attributes a ON e.id = a.entity_id
    WHERE e.project_id = $1
    GROUP BY e.id, p.x, p.y
    ORDER BY e.created_at ASC
  `, [projectId]);

  return entitiesRes.rows;
}

/**
 * Create a new entity with optional initial attributes
 */
export async function createEntity(projectId, { name, type = 'Strong', description = '', parentEntityId = null, initialAttributes = [] }) {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    throw new Error('Entity name is required');
  }

  // Check duplicate entity name within project
  const dupCheck = await query(
    'SELECT id FROM erd_entities WHERE project_id = $1 AND LOWER(name) = LOWER($2)',
    [projectId, cleanName]
  );
  if (dupCheck.rows.length > 0) {
    throw new Error(`Entity "${cleanName}" already exists in this project`);
  }

  // If weak entity, parentEntityId is strongly recommended or required
  const entityType = type === 'Weak' ? 'Weak' : 'Strong';

  const insertRes = await query(
    `INSERT INTO erd_entities (project_id, name, type, description, parent_entity_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectId, cleanName, entityType, description, parentEntityId || null]
  );
  const newEntity = insertRes.rows[0];

  // Default positioning on canvas
  const countRes = await query('SELECT COUNT(*) FROM erd_entities WHERE project_id = $1', [projectId]);
  const entityIndex = parseInt(countRes.rows[0].count, 10) - 1;
  const col = entityIndex % 3;
  const row = Math.floor(entityIndex / 3);
  const posX = 80 + col * 320;
  const posY = 80 + row * 260;

  await query(
    `INSERT INTO erd_node_positions (project_id, entity_id, x, y)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id, entity_id) DO UPDATE SET x = $3, y = $4`,
    [projectId, newEntity.id, posX, posY]
  );

  // If initial attributes provided, add them; otherwise add a default PK id
  if (initialAttributes && initialAttributes.length > 0) {
    for (let i = 0; i < initialAttributes.length; i++) {
      const attr = initialAttributes[i];
      await query(
        `INSERT INTO erd_attributes (entity_id, name, data_type, key_type, is_nullable, default_value, ref_entity_id, ref_attribute_id, order_index, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          newEntity.id,
          attr.name.trim(),
          attr.dataType || 'String',
          attr.keyType || (i === 0 ? 'PK' : 'Normal'),
          attr.isNullable || false,
          attr.defaultValue || null,
          attr.refEntityId || null,
          attr.refAttributeId || null,
          attr.order !== undefined ? attr.order : i,
          attr.description || null
        ]
      );
    }
  } else {
    // Standard default PK for convenience
    const pkName = 'id';
    await query(
      `INSERT INTO erd_attributes (entity_id, name, data_type, key_type, is_nullable, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newEntity.id, pkName, 'Int', 'PK', false, 0]
    );
  }

  // If weak entity with parent, auto-create identifying relationship and identifying FK
  if (entityType === 'Weak' && parentEntityId) {
    await autoHandleWeakEntityRelationship(projectId, parentEntityId, newEntity.id);
  }

  return getEntityWithAttributes(newEntity.id);
}

/**
 * Get single entity with attributes and position
 */
export async function getEntityWithAttributes(entityId) {
  const res = await query(`
    SELECT 
      e.*,
      p.x AS pos_x,
      p.y AS pos_y,
      COALESCE(
        json_agg(
          json_build_object(
            'id', a.id,
            'name', a.name,
            'dataType', a.data_type,
            'keyType', a.key_type,
            'isNullable', a.is_nullable,
            'defaultValue', a.default_value,
            'refEntityId', a.ref_entity_id,
            'refAttributeId', a.ref_attribute_id,
            'order', a.order_index,
            'description', a.description,
            'isPII', a.is_pii,
            'piiType', a.pii_type,
            'retentionDays', a.retention_days,
            'complianceNotes', a.compliance_notes
          ) ORDER BY a.order_index ASC, a.id ASC
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS attributes
    FROM erd_entities e
    LEFT JOIN erd_node_positions p ON e.id = p.entity_id AND p.project_id = e.project_id
    LEFT JOIN erd_attributes a ON e.id = a.entity_id
    WHERE e.id = $1
    GROUP BY e.id, p.x, p.y
  `, [entityId]);

  return res.rows[0] || null;
}

/**
 * Update entity metadata (name, type, description, parentEntityId)
 */
export async function updateEntity(entityId, { name, type, description, parentEntityId }) {
  const entityRes = await query('SELECT * FROM erd_entities WHERE id = $1', [entityId]);
  if (entityRes.rows.length === 0) {
    throw new Error('Entity not found');
  }
  const current = entityRes.rows[0];

  if (name && name.trim().toLowerCase() !== current.name.toLowerCase()) {
    const dupCheck = await query(
      'SELECT id FROM erd_entities WHERE project_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3',
      [current.project_id, name.trim(), entityId]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error(`Entity "${name.trim()}" already exists in this project`);
    }
  }

  const updatedName = name ? name.trim() : current.name;
  const updatedType = type ? (type === 'Weak' ? 'Weak' : 'Strong') : current.type;
  const updatedDesc = description !== undefined ? description : current.description;
  const updatedParent = parentEntityId !== undefined ? (parentEntityId || null) : current.parent_entity_id;

  await query(
    `UPDATE erd_entities 
     SET name = $1, type = $2, description = $3, parent_entity_id = $4, updated_at = CURRENT_TIMESTAMP
     WHERE id = $5`,
    [updatedName, updatedType, updatedDesc, updatedParent, entityId]
  );

  // If switched to weak with parent, check identifying relationship
  if (updatedType === 'Weak' && updatedParent) {
    await autoHandleWeakEntityRelationship(current.project_id, updatedParent, entityId);
  }

  return getEntityWithAttributes(entityId);
}

/**
 * Delete entity and cascade its attributes, positions, and relationships
 */
export async function deleteEntity(entityId) {
  const res = await query('DELETE FROM erd_entities WHERE id = $1 RETURNING *', [entityId]);
  return res.rows[0];
}

/**
 * Bulk save / update attributes for an entity
 */
export async function bulkSaveAttributes(entityId, attributes) {
  const entityRes = await query('SELECT * FROM erd_entities WHERE id = $1', [entityId]);
  if (entityRes.rows.length === 0) {
    throw new Error('Entity not found');
  }
  const entity = entityRes.rows[0];

  // 1. Validation: No duplicate attribute names within entity
  const seenNames = new Set();
  let hasPk = false;

  for (const attr of attributes) {
    const normName = (attr.name || '').trim().toLowerCase();
    if (!normName) {
      throw new Error('Attribute name cannot be empty');
    }
    if (seenNames.has(normName)) {
      throw new Error(`Duplicate attribute name "${attr.name.trim()}" within entity "${entity.name}"`);
    }
    seenNames.add(normName);

    if (attr.keyType === 'PK' || attr.keyType === 'Composite') {
      hasPk = true;
    }

    // FK Validation: If keyType is FK, target entity and column must be valid
    if (attr.keyType === 'FK') {
      if (!attr.refEntityId) {
        throw new Error(`Attribute "${attr.name}" marked as FK must select a target entity`);
      }
      if (attr.refAttributeId) {
        // Validate target attribute is PK
        const targetAttrRes = await query('SELECT key_type FROM erd_attributes WHERE id = $1', [attr.refAttributeId]);
        if (targetAttrRes.rows.length === 0 || (targetAttrRes.rows[0].key_type !== 'PK' && targetAttrRes.rows[0].key_type !== 'Composite')) {
          throw new Error(`Foreign Key "${attr.name}" must reference a Primary Key column in the target entity`);
        }
      }
    }
  }

  // 2. Validation: Every entity must have at least one PK or Composite PK
  if (!hasPk && attributes.length > 0) {
    throw new Error(`Entity "${entity.name}" must have at least one Primary Key (PK)`);
  }

  // Transaction-like bulk replace
  await query('BEGIN');
  try {
    await query('DELETE FROM erd_attributes WHERE entity_id = $1', [entityId]);

    for (let i = 0; i < attributes.length; i++) {
      const a = attributes[i];
      await query(`
        INSERT INTO erd_attributes (
          entity_id, name, data_type, key_type, is_nullable, default_value, ref_entity_id, ref_attribute_id, order_index, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        entityId,
        a.name.trim(),
        a.dataType || 'String',
        a.keyType || 'Normal',
        Boolean(a.isNullable),
        a.defaultValue || null,
        a.refEntityId || null,
        a.refAttributeId || null,
        a.order !== undefined ? a.order : i,
        a.description || null
      ]);
    }
    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }

  return getEntityWithAttributes(entityId);
}

/**
 * Save node positions batch from Canvas drag
 */
export async function saveNodePositions(projectId, positions) {
  // positions: [{ entityId, x, y }, ...]
  for (const pos of positions) {
    await query(`
      INSERT INTO erd_node_positions (project_id, entity_id, x, y)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, entity_id) DO UPDATE SET x = $3, y = $4
    `, [projectId, pos.entityId, pos.x, pos.y]);
  }
  return { success: true, count: positions.length };
}

/**
 * Auto-handle identifying relationship and FK for weak entities
 */
async function autoHandleWeakEntityRelationship(projectId, parentEntityId, weakEntityId) {
  // 1. Check if relationship already exists
  const relCheck = await query(`
    SELECT id FROM erd_relationships 
    WHERE project_id = $1 
      AND source_entity_id = $2 
      AND target_entity_id = $3
  `, [projectId, parentEntityId, weakEntityId]);

  let relId;
  if (relCheck.rows.length === 0) {
    const parentEntityRes = await query('SELECT name FROM erd_entities WHERE id = $1', [parentEntityId]);
    const parentName = parentEntityRes.rows[0]?.name || 'Parent';
    const weakEntityRes = await query('SELECT name FROM erd_entities WHERE id = $1', [weakEntityId]);
    const weakName = weakEntityRes.rows[0]?.name || 'Child';

    const insertRel = await query(`
      INSERT INTO erd_relationships (
        project_id, source_entity_id, target_entity_id, cardinality, name, description, is_identifying, on_delete
      ) VALUES ($1, $2, $3, '1:M', $4, $5, true, 'CASCADE')
      RETURNING id
    `, [
      projectId,
      parentEntityId,
      weakEntityId,
      'identifies',
      `${parentName} strongly identifies weak entity ${weakName}`
    ]);
    relId = insertRel.rows[0].id;
  } else {
    relId = relCheck.rows[0].id;
    await query(`
      UPDATE erd_relationships 
      SET is_identifying = true, on_delete = 'CASCADE'
      WHERE id = $1
    `, [relId]);
  }

  // 2. Propagate parent's PK as composite PK / FK into weak entity
  await autoPropagateForeignKey(projectId, parentEntityId, weakEntityId, true);
  return relId;
}

/**
 * Auto-propagate FK column into target entity for 1:M relationship
 */
export async function autoPropagateForeignKey(projectId, sourceEntityId, targetEntityId, isIdentifying = false) {
  // Get source entity info and its PK attribute
  const sourceRes = await query('SELECT name FROM erd_entities WHERE id = $1', [sourceEntityId]);
  if (sourceRes.rows.length === 0) return;
  const sourceName = sourceRes.rows[0].name;

  const pkRes = await query(`
    SELECT * FROM erd_attributes 
    WHERE entity_id = $1 AND (key_type = 'PK' OR key_type = 'Composite')
    ORDER BY order_index ASC LIMIT 1
  `, [sourceEntityId]);

  if (pkRes.rows.length === 0) return;
  const sourcePk = pkRes.rows[0];

  // Conventional FK attribute name: e.g. customer_id, order_id
  const cleanSourceName = sourceName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const fkAttrName = `${cleanSourceName}_${sourcePk.name.toLowerCase()}`;

  // Check if FK attribute already exists in target
  const existingAttr = await query(`
    SELECT id, key_type FROM erd_attributes 
    WHERE entity_id = $1 AND (LOWER(name) = LOWER($2) OR (ref_entity_id = $3 AND ref_attribute_id = $4))
  `, [targetEntityId, fkAttrName, sourceEntityId, sourcePk.id]);

  if (existingAttr.rows.length === 0) {
    // Determine key type: If identifying weak entity, it forms part of the Composite PK!
    const keyType = isIdentifying ? 'Composite' : 'FK';

    // Get max order index
    const orderRes = await query('SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM erd_attributes WHERE entity_id = $1', [targetEntityId]);
    const nextOrder = orderRes.rows[0].next_order;

    await query(`
      INSERT INTO erd_attributes (
        entity_id, name, data_type, key_type, is_nullable, default_value, ref_entity_id, ref_attribute_id, order_index, description
      ) VALUES ($1, $2, $3, $4, false, NULL, $5, $6, $7, $8)
    `, [
      targetEntityId,
      fkAttrName,
      sourcePk.data_type,
      keyType,
      sourceEntityId,
      sourcePk.id,
      nextOrder,
      `Foreign key reference to ${sourceName}.${sourcePk.name}`
    ]);
  }
}

/**
 * Handle Many-to-Many resolution: auto-create junction table entity with composite PKs
 */
export async function resolveManyToManyJunction(projectId, relationshipId, sourceEntityId, targetEntityId, customName = null) {
  const [sourceRes, targetRes] = await Promise.all([
    query('SELECT * FROM erd_entities WHERE id = $1', [sourceEntityId]),
    query('SELECT * FROM erd_entities WHERE id = $1', [targetEntityId]),
  ]);

  if (sourceRes.rows.length === 0 || targetRes.rows.length === 0) {
    throw new Error('Source or target entity not found');
  }

  const source = sourceRes.rows[0];
  const target = targetRes.rows[0];

  // Name junction table: e.g. CustomerOrder or customName
  const junctionName = customName || `${source.name}_${target.name}`;

  // Check if junction entity already exists
  let junctionEntity;
  const existingJunction = await query(
    'SELECT * FROM erd_entities WHERE project_id = $1 AND LOWER(name) = LOWER($2)',
    [projectId, junctionName]
  );

  if (existingJunction.rows.length > 0) {
    junctionEntity = existingJunction.rows[0];
  } else {
    // Create junction entity
    const insertRes = await query(`
      INSERT INTO erd_entities (project_id, name, type, description)
      VALUES ($1, $2, 'Strong', $3)
      RETURNING *
    `, [projectId, junctionName, `Junction table resolving M:N relationship between ${source.name} and ${target.name}`]);
    junctionEntity = insertRes.rows[0];

    // Place between source and target on canvas
    const posRes = await query(`
      SELECT x, y FROM erd_node_positions WHERE project_id = $1 AND entity_id IN ($2, $3)
    `, [projectId, sourceEntityId, targetEntityId]);

    let jX = 300;
    let jY = 200;
    if (posRes.rows.length >= 2) {
      jX = (posRes.rows[0].x + posRes.rows[1].x) / 2;
      jY = (posRes.rows[0].y + posRes.rows[1].y) / 2 + 50;
    }

    await query(`
      INSERT INTO erd_node_positions (project_id, entity_id, x, y)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, entity_id) DO UPDATE SET x = $3, y = $4
    `, [projectId, junctionEntity.id, jX, jY]);

    // Fetch PKs from both source and target
    const [sourcePkRes, targetPkRes] = await Promise.all([
      query("SELECT * FROM erd_attributes WHERE entity_id = $1 AND (key_type = 'PK' OR key_type = 'Composite') ORDER BY order_index ASC LIMIT 1", [sourceEntityId]),
      query("SELECT * FROM erd_attributes WHERE entity_id = $1 AND (key_type = 'PK' OR key_type = 'Composite') ORDER BY order_index ASC LIMIT 1", [targetEntityId]),
    ]);

    const sPk = sourcePkRes.rows[0] || { name: 'id', data_type: 'Int', id: null };
    const tPk = targetPkRes.rows[0] || { name: 'id', data_type: 'Int', id: null };

    const sFkName = `${source.name.toLowerCase()}_${sPk.name.toLowerCase()}`;
    const tFkName = `${target.name.toLowerCase()}_${tPk.name.toLowerCase()}`;

    // Insert Composite PK / FK columns into junction table
    await query(`
      INSERT INTO erd_attributes (entity_id, name, data_type, key_type, is_nullable, ref_entity_id, ref_attribute_id, order_index, description)
      VALUES 
        ($1, $2, $3, 'Composite', false, $4, $5, 0, $6),
        ($1, $7, $8, 'Composite', false, $9, $10, 1, $11),
        ($1, 'created_at', 'Date', 'Normal', false, NULL, NULL, 2, 'Timestamp record created')
    `, [
      junctionEntity.id, sFkName, sPk.data_type, sourceEntityId, sPk.id, `Composite PK / FK referencing ${source.name}`,
      tFkName, tPk.data_type, targetEntityId, tPk.id, `Composite PK / FK referencing ${target.name}`
    ]);
  }

  // Link relationship to junction_entity_id
  await query('UPDATE erd_relationships SET junction_entity_id = $1 WHERE id = $2', [junctionEntity.id, relationshipId]);

  return junctionEntity;
}

/**
 * Fetch all relationships for a project with entity metadata
 */
export async function getProjectRelationships(projectId) {
  const res = await query(`
    SELECT 
      r.*,
      se.name AS source_entity_name,
      se.type AS source_entity_type,
      te.name AS target_entity_name,
      te.type AS target_entity_type,
      je.name AS junction_entity_name
    FROM erd_relationships r
    JOIN erd_entities se ON r.source_entity_id = se.id
    JOIN erd_entities te ON r.target_entity_id = te.id
    LEFT JOIN erd_entities je ON r.junction_entity_id = je.id
    WHERE r.project_id = $1
    ORDER BY r.created_at ASC
  `, [projectId]);

  return res.rows.map((rel) => {
    // Generate bidirectional descriptions
    // (a) Source has many Target / (b) Target belongs to one Source
    let descA = '';
    let descB = '';
    if (rel.cardinality === '1:1') {
      descA = `${rel.source_entity_name} has one ${rel.target_entity_name}`;
      descB = `${rel.target_entity_name} belongs to one ${rel.source_entity_name}`;
    } else if (rel.cardinality === '1:M') {
      descA = `${rel.source_entity_name} has many ${rel.target_entity_name}`;
      descB = `${rel.target_entity_name} belongs to one ${rel.source_entity_name}`;
    } else if (rel.cardinality === 'M:N') {
      descA = `${rel.source_entity_name} relates to many ${rel.target_entity_name}`;
      descB = `${rel.target_entity_name} relates to many ${rel.source_entity_name}`;
    }

    return {
      ...rel,
      bidirectional: {
        forward: descA,
        reverse: descB,
        verbalSentence: `${rel.source_entity_name} ${rel.name || 'relates to'} ${rel.target_entity_name}`
      }
    };
  });
}

/**
 * Create a new relationship with auto-propagation logic
 */
export async function createRelationship(projectId, { sourceEntityId, targetEntityId, cardinality = '1:M', name = 'relates to', description = '', isIdentifying = false, onDelete = 'CASCADE' }) {
  if (sourceEntityId === targetEntityId) {
    throw new Error('Self-referencing relationship requires distinct handling or is not permitted');
  }

  const insertRes = await query(`
    INSERT INTO erd_relationships (
      project_id, source_entity_id, target_entity_id, cardinality, name, description, is_identifying, on_delete
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [projectId, sourceEntityId, targetEntityId, cardinality, name, description, Boolean(isIdentifying), onDelete || 'CASCADE']);

  const rel = insertRes.rows[0];

  // 1:M Auto-FK Propagation: inject FK column to the "Many" side (target)
  if (cardinality === '1:M') {
    await autoPropagateForeignKey(projectId, sourceEntityId, targetEntityId, Boolean(isIdentifying));
  } else if (cardinality === 'M:N') {
    // M:N Resolution: auto-create junction entity
    await resolveManyToManyJunction(projectId, rel.id, sourceEntityId, targetEntityId);
  }

  return rel;
}

/**
 * Update relationship properties
 */
export async function updateRelationship(relationshipId, { cardinality, name, description, isIdentifying, onDelete }) {
  const relRes = await query('SELECT * FROM erd_relationships WHERE id = $1', [relationshipId]);
  if (relRes.rows.length === 0) {
    throw new Error('Relationship not found');
  }
  const current = relRes.rows[0];

  const updatedCard = cardinality || current.cardinality;
  const updatedName = name !== undefined ? name : current.name;
  const updatedDesc = description !== undefined ? description : current.description;
  const updatedIdent = isIdentifying !== undefined ? Boolean(isIdentifying) : current.is_identifying;
  const updatedDel = onDelete || current.on_delete;

  const updateRes = await query(`
    UPDATE erd_relationships
    SET cardinality = $1, name = $2, description = $3, is_identifying = $4, on_delete = $5, updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `, [updatedCard, updatedName, updatedDesc, updatedIdent, updatedDel, relationshipId]);

  const updated = updateRes.rows[0];

  // If switched to M:N and no junction entity exists yet
  if (updatedCard === 'M:N' && !updated.junction_entity_id) {
    await resolveManyToManyJunction(current.project_id, updated.id, current.source_entity_id, current.target_entity_id);
  } else if (updatedCard === '1:M') {
    await autoPropagateForeignKey(current.project_id, current.source_entity_id, current.target_entity_id, updatedIdent);
  }

  return updated;
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(relationshipId) {
  const res = await query('DELETE FROM erd_relationships WHERE id = $1 RETURNING *', [relationshipId]);
  return res.rows[0];
}

/**
 * MODULE 5: Normalization Engine (1NF, 2NF, 3NF Validator)
 */
export async function runNormalizationAudit(projectId) {
  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);

  const report = {
    projectId,
    totalEntities: entities.length,
    score: 100, // Starts at 100, penalties subtracted
    violations: [],
    insights: [],
    firstNormalForm: { passed: true, issues: [] },
    secondNormalForm: { passed: true, issues: [] },
    thirdNormalForm: { passed: true, issues: [] },
  };

  if (entities.length === 0) {
    report.score = 0;
    report.insights.push('No entities defined yet. Add entities to run normalization analysis.');
    return report;
  }

  // 1NF Check
  // Rule 1: Every entity must have a Primary Key
  // Rule 2: Attribute values must be atomic (no multi-valued columns like emails, phone_numbers, tags, comma-separated lists)
  // Rule 3: No repeating groups (e.g. phone1, phone2, address_line1, address_line2)
  for (const entity of entities) {
    const pks = entity.attributes.filter((a) => a.keyType === 'PK' || a.keyType === 'Composite');
    if (pks.length === 0) {
      report.firstNormalForm.passed = false;
      const issue = {
        entityId: entity.id,
        entityName: entity.name,
        nf: '1NF',
        type: 'MISSING_PRIMARY_KEY',
        severity: 'critical',
        message: `Entity "${entity.name}" does not have a Primary Key. 1NF requires a unique identifier for every tuple.`,
        recommendation: `Designate an attribute as Primary Key (e.g. "id" or composite key).`
      };
      report.firstNormalForm.issues.push(issue);
      report.violations.push(issue);
      report.score -= 20;
    }

    // Check multi-valued attribute heuristics (plural names, array-like indicators)
    const multiValuedSuspects = ['tags', 'emails', 'phones', 'phone_numbers', 'items', 'roles', 'addresses', 'images', 'attachments', 'options'];
    for (const attr of entity.attributes) {
      const lowerName = attr.name.toLowerCase();
      if (multiValuedSuspects.includes(lowerName) || (lowerName.endsWith('s') && !lowerName.endsWith('ss') && !lowerName.endsWith('status') && !lowerName.endsWith('address'))) {
        // High likelihood of non-atomic / multi-valued attribute in 1NF
        const issue = {
          entityId: entity.id,
          entityName: entity.name,
          attributeName: attr.name,
          nf: '1NF',
          type: 'MULTI_VALUED_ATTRIBUTE',
          severity: 'warning',
          message: `Attribute "${attr.name}" in entity "${entity.name}" suggests a multi-valued or array list, violating 1NF atomicity.`,
          recommendation: `Split multi-valued data into a separate child entity related by 1:M foreign key.`
        };
        report.firstNormalForm.issues.push(issue);
        report.violations.push(issue);
        report.score -= 8;
      }
    }

    // Check repeating groups: e.g. phone1 & phone2, tag_1 & tag_2
    const numberedPattern = /^(.+?)[_-]?([0-9])$/i;
    const baseGroups = {};
    for (const attr of entity.attributes) {
      const match = attr.name.match(numberedPattern);
      if (match) {
        const base = match[1].toLowerCase();
        baseGroups[base] = (baseGroups[base] || 0) + 1;
      }
    }
    for (const [base, count] of Object.entries(baseGroups)) {
      if (count > 1) {
        report.firstNormalForm.passed = false;
        const issue = {
          entityId: entity.id,
          entityName: entity.name,
          nf: '1NF',
          type: 'REPEATING_GROUP',
          severity: 'warning',
          message: `Repeating attribute group detected for "${base}*" (${count} columns) in "${entity.name}". Violates 1NF.`,
          recommendation: `Normalize repeating columns into a child entity or table with a foreign key.`
        };
        report.firstNormalForm.issues.push(issue);
        report.violations.push(issue);
        report.score -= 10;
      }
    }
  }

  // 2NF Check
  // Rule: Must be in 1NF, and no non-prime attribute may depend on only a subset of a Composite Primary Key (No partial dependencies).
  for (const entity of entities) {
    const compositePks = entity.attributes.filter((a) => a.keyType === 'Composite');
    if (compositePks.length > 1) {
      // Check non-prime attributes
      const nonPrimeAttrs = entity.attributes.filter((a) => a.keyType === 'Normal');
      for (const nonPrime of nonPrimeAttrs) {
        // If non-prime attribute references one of the composite entities directly or has prefix matching only one composite PK
        for (const cPk of compositePks) {
          const prefix = cPk.name.replace(/_id$/i, '').toLowerCase();
          if (prefix.length > 2 && nonPrime.name.toLowerCase().startsWith(prefix) && nonPrime.name.toLowerCase() !== cPk.name.toLowerCase()) {
            report.secondNormalForm.passed = false;
            const issue = {
              entityId: entity.id,
              entityName: entity.name,
              attributeName: nonPrime.name,
              nf: '2NF',
              type: 'PARTIAL_DEPENDENCY',
              severity: 'warning',
              message: `Attribute "${nonPrime.name}" in "${entity.name}" appears to depend partially on "${cPk.name}", not the whole composite primary key.`,
              recommendation: `Move "${nonPrime.name}" into the parent entity "${prefix}" where it natively belongs.`
            };
            report.secondNormalForm.issues.push(issue);
            report.violations.push(issue);
            report.score -= 12;
          }
        }
      }
    }
  }

  // 3NF Check
  // Rule: Must be in 2NF, and no non-key attribute may depend on another non-key attribute (No transitive dependencies: X -> Y -> Z).
  // Common indicators: zip_code -> city / state; department_id -> department_name inside Employee; etc.
  for (const entity of entities) {
    const normalAttrs = entity.attributes.filter((a) => a.keyType === 'Normal');
    const normalNames = normalAttrs.map((a) => a.name.toLowerCase());

    // Check classic postal / address transitive dependency
    if (normalNames.some((n) => n.includes('zip') || n.includes('postal')) &&
      normalNames.some((n) => n.includes('city') || n.includes('state') || n.includes('province'))) {
      report.thirdNormalForm.passed = false;
      const issue = {
        entityId: entity.id,
        entityName: entity.name,
        nf: '3NF',
        type: 'TRANSITIVE_DEPENDENCY',
        severity: 'info',
        message: `Transitive dependency candidate found in "${entity.name}": City/State typically transitively depend on Postal/Zip code.`,
        recommendation: `Consider isolating Postal Code/City/State into a ZipCode lookup entity to reach strict 3NF.`
      };
      report.thirdNormalForm.issues.push(issue);
      report.violations.push(issue);
      report.score -= 5;
    }

    // Check if an entity contains both a FK and descriptive attributes of that FK
    const fks = entity.attributes.filter((a) => a.keyType === 'FK');
    for (const fk of fks) {
      const fkPrefix = fk.name.replace(/_id$/i, '').toLowerCase();
      const descriptiveMatches = normalAttrs.filter((a) =>
        a.name.toLowerCase().startsWith(fkPrefix + '_') && a.name.toLowerCase() !== fk.name.toLowerCase()
      );
      if (descriptiveMatches.length > 0) {
        report.thirdNormalForm.passed = false;
        const matchedNames = descriptiveMatches.map((m) => m.name).join(', ');
        const issue = {
          entityId: entity.id,
          entityName: entity.name,
          attributeName: matchedNames,
          nf: '3NF',
          type: 'TRANSITIVE_DEPENDENCY_FK_DESCRIPTIVE',
          severity: 'warning',
          message: `Descriptive columns (${matchedNames}) duplicate fields from foreign key "${fk.name}" in "${entity.name}".`,
          recommendation: `Remove redundant descriptive columns from "${entity.name}". Join through "${fk.name}" instead.`
        };
        report.thirdNormalForm.issues.push(issue);
        report.violations.push(issue);
        report.score -= 10;
      }
    }
  }

  // Ensure score bounded between 0 and 100
  report.score = Math.max(0, Math.min(100, report.score));

  if (report.violations.length === 0) {
    report.insights.push('Excellent! All entities satisfy 1NF, 2NF, and 3NF normalization rules.');
  } else {
    report.insights.push(`Found ${report.violations.length} normalization recommendation(s) across the schema.`);
  }

  return report;
}

/**
 * MODULE 5: De-normalization Engine
 * Flatten parent-child (1:M) tables into de-normalized reporting / read-optimized tables
 */
export async function computeDenormalizedSchema(projectId, selectedTableIds = null) {
  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);

  // Map of entities by ID
  const entityMap = new Map();
  entities.forEach((e) => entityMap.set(e.id, e));

  // Determine which entities get de-normalized:
  // If selectedTableIds is provided, only de-normalize those child tables; otherwise de-normalize all child tables in 1:M relationships.
  const denormalizedTables = [];

  for (const entity of entities) {
    const isSelected = selectedTableIds ? selectedTableIds.includes(entity.id) : true;

    // Find parent 1:M relationships where this entity is the child (target)
    const incoming1MRels = relationships.filter(
      (r) => r.target_entity_id === entity.id && r.cardinality === '1:M'
    );

    if (incoming1MRels.length > 0 && isSelected) {
      // Child table absorbs parent descriptive attributes
      const flattenedAttributes = [...entity.attributes.map((a) => ({ ...a, sourceTable: entity.name, origin: 'native' }))];

      const absorbedParents = [];

      for (const rel of incoming1MRels) {
        const parentEntity = entityMap.get(rel.source_entity_id);
        if (parentEntity) {
          absorbedParents.push(parentEntity.name);
          // Grab non-PK parent attributes to flatten
          const parentDescriptive = parentEntity.attributes.filter(
            (a) => a.keyType !== 'PK' && a.keyType !== 'Composite'
          );

          for (const pAttr of parentDescriptive) {
            flattenedAttributes.push({
              name: `${parentEntity.name.toLowerCase()}_${pAttr.name.toLowerCase()}`,
              dataType: pAttr.dataType,
              keyType: 'Normal',
              isNullable: true,
              defaultValue: pAttr.defaultValue,
              description: `De-normalized from ${parentEntity.name}.${pAttr.name}`,
              sourceTable: parentEntity.name,
              origin: 'inherited'
            });
          }
        }
      }

      denormalizedTables.push({
        entityId: entity.id,
        name: `denorm_${entity.name.toLowerCase()}`,
        originalName: entity.name,
        type: 'De-normalized Child View',
        absorbedParents,
        attributes: flattenedAttributes,
        isDenormalized: true
      });
    } else {
      // Regular table kept in schema
      denormalizedTables.push({
        entityId: entity.id,
        name: entity.name.toLowerCase(),
        originalName: entity.name,
        type: entity.type,
        absorbedParents: [],
        attributes: entity.attributes.map((a) => ({ ...a, sourceTable: entity.name, origin: 'native' })),
        isDenormalized: false
      });
    }
  }

  return {
    projectId,
    normalizedEntities: entities,
    denormalizedTables,
    relationships
  };
}

/**
 * Generate Raw PostgreSQL DDL Scripts for both Normalized & De-normalized Schemas
 */
export async function generateSqlScripts(projectId, selectedTableIds = null) {
  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);
  const denormData = await computeDenormalizedSchema(projectId, selectedTableIds);

  // Helper to map data types to PostgreSQL
  const mapPgType = (t) => {
    const s = (t || '').toLowerCase();
    if (s.includes('int')) return 'INTEGER';
    if (s.includes('date') || s.includes('time')) return 'TIMESTAMP WITH TIME ZONE';
    if (s.includes('bool')) return 'BOOLEAN';
    if (s.includes('decimal') || s.includes('float') || s.includes('double') || s.includes('num')) return 'NUMERIC(12,2)';
    if (s.includes('text')) return 'TEXT';
    return 'VARCHAR(255)';
  };

  // 1. Build Normalized SQL DDL
  const normalizedSqlParts = [
    `-- ========================================================`,
    `-- NORMALIZED POSTGRESQL DDL SCHEMA (3NF)`,
    `-- Project ID: ${projectId}`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- ========================================================\n`
  ];

  // Drop tables in reverse order
  for (const ent of [...entities].reverse()) {
    normalizedSqlParts.push(`DROP TABLE IF EXISTS ${ent.name.toLowerCase()} CASCADE;`);
  }
  normalizedSqlParts.push('');

  // Create Normalized Tables
  for (const ent of entities) {
    const tableName = ent.name.toLowerCase();
    normalizedSqlParts.push(`-- Entity: ${ent.name} (${ent.type})`);
    if (ent.description) {
      normalizedSqlParts.push(`-- Description: ${ent.description}`);
    }
    normalizedSqlParts.push(`CREATE TABLE ${tableName} (`);

    const colDefs = [];
    const pkCols = [];

    for (const attr of ent.attributes) {
      const colName = attr.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const pgType = mapPgType(attr.dataType);
      let def = `    ${colName.padEnd(20)} ${pgType}`;

      if (attr.keyType === 'PK' || attr.keyType === 'Composite') {
        pkCols.push(colName);
        def += ' NOT NULL';
      } else if (!attr.isNullable) {
        def += ' NOT NULL';
      }

      if (attr.defaultValue) {
        def += ` DEFAULT ${attr.defaultValue}`;
      }

      colDefs.push(def);
    }

    if (pkCols.length > 0) {
      colDefs.push(`    PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // Foreign Key Constraints
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const refEnt = entities.find((e) => e.id === fk.refEntityId);
      const refAttr = refEnt?.attributes.find((a) => a.id === fk.refAttributeId) || { name: 'id' };
      if (refEnt) {
        const colName = fk.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const refTable = refEnt.name.toLowerCase();
        const refCol = refAttr.name.toLowerCase();
        colDefs.push(`    CONSTRAINT fk_${tableName}_${colName} FOREIGN KEY (${colName}) REFERENCES ${refTable}(${refCol}) ON DELETE CASCADE`);
      }
    }

    normalizedSqlParts.push(colDefs.join(',\n'));
    normalizedSqlParts.push(`);\n`);
  }

  // Add Indexes for FKs
  normalizedSqlParts.push(`-- Performance Foreign Key Indexes`);
  for (const ent of entities) {
    const tableName = ent.name.toLowerCase();
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const colName = fk.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      normalizedSqlParts.push(`CREATE INDEX idx_${tableName}_${colName} ON ${tableName}(${colName});`);
    }
  }

  // 2. Build De-normalized SQL DDL
  const denormalizedSqlParts = [
    `-- ========================================================`,
    `-- DE-NORMALIZED POSTGRESQL DDL SCHEMA (Flattened Read-Optimized)`,
    `-- Project ID: ${projectId}`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- Absorbs parent descriptive columns into child tables`,
    `-- ========================================================\n`
  ];

  for (const table of denormData.denormalizedTables) {
    denormalizedSqlParts.push(`DROP TABLE IF EXISTS ${table.name} CASCADE;`);
  }
  denormalizedSqlParts.push('');

  for (const table of denormData.denormalizedTables) {
    denormalizedSqlParts.push(`-- Table: ${table.name} (${table.type})`);
    if (table.absorbedParents.length > 0) {
      denormalizedSqlParts.push(`-- Absorbed Parent Entities: ${table.absorbedParents.join(', ')}`);
    }
    denormalizedSqlParts.push(`CREATE TABLE ${table.name} (`);

    const colDefs = [];
    const pkCols = [];

    for (const attr of table.attributes) {
      const colName = attr.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const pgType = mapPgType(attr.dataType);
      let def = `    ${colName.padEnd(28)} ${pgType}`;

      if (attr.keyType === 'PK' || attr.keyType === 'Composite') {
        pkCols.push(colName);
        def += ' NOT NULL';
      } else if (!attr.isNullable && attr.origin === 'native') {
        def += ' NOT NULL';
      }

      if (attr.defaultValue) {
        def += ` DEFAULT ${attr.defaultValue}`;
      }

      colDefs.push(def);
    }

    if (pkCols.length > 0) {
      colDefs.push(`    PRIMARY KEY (${pkCols.join(', ')})`);
    }

    denormalizedSqlParts.push(colDefs.join(',\n'));
    denormalizedSqlParts.push(`);\n`);

    // Reporting index on flattened inherited columns
    const inheritedCols = table.attributes.filter((a) => a.origin === 'inherited');
    if (inheritedCols.length > 0) {
      const firstInherited = inheritedCols[0].name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      denormalizedSqlParts.push(`CREATE INDEX idx_${table.name}_${firstInherited} ON ${table.name}(${firstInherited});\n`);
    }
  }

  return {
    normalizedSql: normalizedSqlParts.join('\n'),
    denormalizedSql: denormalizedSqlParts.join('\n')
  };
}

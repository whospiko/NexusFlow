import pkg from 'node-sql-parser';
import { query } from '../config/db.js';
import {
  createEntity,
  bulkSaveAttributes,
  createRelationship,
  saveNodePositions,
  getProjectEntities,
  getProjectRelationships,
} from './erdService.js';

const ParserClass = pkg.default?.Parser || pkg.Parser || pkg.default || pkg;
const sqlParser = new ParserClass();

// Helper to normalize data types to standard ERD types
function normalizeDataType(rawType) {
  const t = (rawType || '').toLowerCase();
  if (t.includes('int') || t.includes('serial')) return 'Int';
  if (t.includes('date') || t.includes('time')) return 'Date';
  if (t.includes('bool')) return 'Boolean';
  if (t.includes('decimal') || t.includes('float') || t.includes('double') || t.includes('num') || t.includes('real') || t.includes('money')) return 'Decimal';
  if (t.includes('text') || t.includes('clob')) return 'Text';
  return 'String';
}

/**
 * 1. SQL PARSER ENGINE (using node-sql-parser with robust regex fallback)
 */
export function parseSqlDdl(sqlText) {
  const cleanSql = (sqlText || '')
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .trim();

  if (!cleanSql) {
    throw new Error('SQL script cannot be empty');
  }

  const parsedEntities = [];
  const parsedRelationships = [];

  // Try parsing with node-sql-parser AST
  let parsedSuccessfullyWithAst = false;
  try {
    const ast = sqlParser.astify(cleanSql);
    const stmts = Array.isArray(ast) ? ast : [ast];

    for (const stmt of stmts) {
      if (stmt && stmt.type === 'create' && stmt.keyword === 'table') {
        const rawTableName = stmt.table?.[0]?.table || 'unnamed_table';
        const tableName = rawTableName.replace(/[`"']/g, '');
        const attributes = [];
        const tablePks = new Set();
        const fks = [];

        // Check definitions
        const defs = stmt.create_definitions || [];

        // First pass: find explicit PRIMARY KEY and FOREIGN KEY table constraints
        for (const def of defs) {
          if (def.constraint_type === 'primary key' && Array.isArray(def.definition)) {
            for (const col of def.definition) {
              const colName = (col.column || col).toString().replace(/[`"']/g, '');
              tablePks.add(colName);
            }
          } else if (def.constraint_type === 'foreign key') {
            const colName = def.definition?.[0]?.column?.replace(/[`"']/g, '');
            const targetTable = def.reference_definition?.table?.[0]?.table?.replace(/[`"']/g, '');
            const targetCol = def.reference_definition?.definition?.[0]?.column?.replace(/[`"']/g, '');
            if (colName && targetTable) {
              fks.push({ colName, targetTable, targetCol: targetCol || 'id' });
            }
          }
        }

        // Second pass: column attributes
        let order = 0;
        for (const def of defs) {
          if (def.resource === 'column' && def.column) {
            const colName = def.column.column?.replace(/[`"']/g, '');
            const rawType = def.definition?.dataType || 'VARCHAR';
            const dataType = normalizeDataType(rawType);
            const isPk = def.primary_key === 'primary key' || tablePks.has(colName);
            const isNullable = def.nullable?.type !== 'not null' && !isPk;

            let keyType = 'Normal';
            if (isPk) {
              keyType = tablePks.size > 1 ? 'Composite' : 'PK';
            }

            attributes.push({
              name: colName,
              dataType,
              keyType,
              isNullable,
              defaultValue: def.default_val?.value ? String(def.default_val.value) : null,
              order: order++,
            });
          }
        }

        // Ensure at least one PK exists
        const hasPk = attributes.some((a) => a.keyType === 'PK' || a.keyType === 'Composite');
        if (!hasPk && attributes.length > 0) {
          attributes[0].keyType = 'PK';
          attributes[0].isNullable = false;
        }

        parsedEntities.push({
          name: tableName,
          type: 'Strong',
          description: `Imported table "${tableName}"`,
          attributes,
          fks,
        });
      }
    }

    if (parsedEntities.length > 0) {
      parsedSuccessfullyWithAst = true;
    }
  } catch (astErr) {
    console.warn('AST parse failed, switching to regex fallback:', astErr.message);
  }

  // Regex Fallback Parser (Robust against dialect quirks like PostgreSQL SERIAL, Oracle PL/SQL, etc.)
  if (!parsedSuccessfullyWithAst) {
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|\[)?([a-zA-Z0-9_]+)(?:`|"|\])?\s*\(([\s\S]*?)\)(?:[^;]*;|$)/gi;
    let match;

    while ((match = tableRegex.exec(cleanSql)) !== null) {
      const tableName = match[1];
      const body = match[2];

      const attributes = [];
      const tablePks = new Set();
      const fks = [];

      // Split body by commas (ignoring commas inside parentheses like VARCHAR(255))
      const parts = body.split(/,(?![^(]*\))/);
      let order = 0;

      for (const rawPart of parts) {
        const line = rawPart.trim();
        if (!line) continue;

        // Table-level PRIMARY KEY constraint
        const pkConstraintMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkConstraintMatch) {
          const pkCols = pkConstraintMatch[1].split(',').map((c) => c.trim().replace(/[`"\[\]]/g, ''));
          pkCols.forEach((c) => tablePks.add(c));
          continue;
        }

        // Table-level FOREIGN KEY constraint
        const fkConstraintMatch = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:`|"|\[)?([a-zA-Z0-9_]+)(?:`|"|\])?\s*\(([^)]+)\)/i);
        if (fkConstraintMatch) {
          const colName = fkConstraintMatch[1].trim().replace(/[`"\[\]]/g, '');
          const targetTable = fkConstraintMatch[2].trim().replace(/[`"\[\]]/g, '');
          const targetCol = fkConstraintMatch[3].trim().replace(/[`"\[\]]/g, '');
          fks.push({ colName, targetTable, targetCol });
          continue;
        }

        // Column definition: [name] [type] [constraints...]
        const colMatch = line.match(/^(?:`|"|\[)?([a-zA-Z0-9_]+)(?:`|"|\])?\s+([a-zA-Z0-9_]+(?:\([^)]*\))?)([\s\S]*)$/i);
        if (colMatch) {
          const colName = colMatch[1];
          const rawType = colMatch[2];
          const rest = colMatch[3] || '';

          const dataType = normalizeDataType(rawType);
          const isPk = /PRIMARY\s+KEY/i.test(rest) || tablePks.has(colName);
          const isNotNull = /NOT\s+NULL/i.test(rest) || isPk;

          // Default value match
          const defMatch = rest.match(/DEFAULT\s+([^,\s]+)/i);
          const defaultValue = defMatch ? defMatch[1].replace(/['"]/g, '') : null;

          attributes.push({
            name: colName,
            dataType,
            keyType: isPk ? 'PK' : 'Normal',
            isNullable: !isNotNull,
            defaultValue,
            order: order++,
          });
        }
      }

      // If composite PKs detected
      if (tablePks.size > 1) {
        for (const attr of attributes) {
          if (tablePks.has(attr.name)) {
            attr.keyType = 'Composite';
            attr.isNullable = false;
          }
        }
      }

      // Ensure at least one PK
      const hasPk = attributes.some((a) => a.keyType === 'PK' || a.keyType === 'Composite');
      if (!hasPk && attributes.length > 0) {
        attributes[0].keyType = 'PK';
        attributes[0].isNullable = false;
      }

      parsedEntities.push({
        name: tableName,
        type: 'Strong',
        description: `Imported table "${tableName}"`,
        attributes,
        fks,
      });
    }
  }

  // Deduplicate and resolve relationships across parsed entities
  const entityNameMap = new Map();
  parsedEntities.forEach((e) => entityNameMap.set(e.name.toLowerCase(), e));

  for (const ent of parsedEntities) {
    if (ent.fks && ent.fks.length > 0) {
      for (const fk of ent.fks) {
        const targetEnt = entityNameMap.get(fk.targetTable.toLowerCase());
        if (targetEnt) {
          // Mark FK on the attribute
          const attr = ent.attributes.find((a) => a.name.toLowerCase() === fk.colName.toLowerCase());
          if (attr && attr.keyType !== 'PK' && attr.keyType !== 'Composite') {
            attr.keyType = 'FK';
          }

          parsedRelationships.push({
            sourceEntityName: targetEnt.name,
            targetEntityName: ent.name,
            cardinality: '1:M',
            name: 'contains',
            description: `${targetEnt.name} relates to ${ent.name}`,
            onDelete: 'CASCADE',
          });
        }
      }
    }
  }

  return {
    entities: parsedEntities,
    relationships: parsedRelationships,
  };
}

/**
 * 2. IMPORT SQL DDL SCRIPT INTO PROJECT (Pure SQL Postgres Persistence)
 */
export async function importSqlIntoProject(projectId, sqlText, { overwrite = false } = {}) {
  const { entities, relationships } = parseSqlDdl(sqlText);

  if (entities.length === 0) {
    throw new Error('No valid CREATE TABLE statements detected in SQL script');
  }

  if (overwrite) {
    // Delete existing entities for clean overwrite
    await query('DELETE FROM erd_entities WHERE project_id = $1', [projectId]);
  }

  const createdEntitiesMap = new Map();

  // Insert Entities & Attributes
  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i];
    try {
      const created = await createEntity(projectId, {
        name: ent.name,
        type: ent.type || 'Strong',
        description: ent.description || '',
        initialAttributes: ent.attributes,
      });
      createdEntitiesMap.set(ent.name.toLowerCase(), created);
    } catch (err) {
      // If entity already exists and not overwriting, load it
      const existing = await query('SELECT * FROM erd_entities WHERE project_id = $1 AND LOWER(name) = LOWER($2)', [projectId, ent.name]);
      if (existing.rows.length > 0) {
        createdEntitiesMap.set(ent.name.toLowerCase(), existing.rows[0]);
      }
    }
  }

  // Insert Relationships & link FK references
  for (const rel of relationships) {
    const sourceEnt = createdEntitiesMap.get(rel.sourceEntityName.toLowerCase());
    const targetEnt = createdEntitiesMap.get(rel.targetEntityName.toLowerCase());

    if (sourceEnt && targetEnt && sourceEnt.id !== targetEnt.id) {
      try {
        await createRelationship(projectId, {
          sourceEntityId: sourceEnt.id,
          targetEntityId: targetEnt.id,
          cardinality: rel.cardinality || '1:M',
          name: rel.name || 'relates to',
          description: rel.description || '',
          onDelete: rel.onDelete || 'CASCADE',
        });
      } catch (relErr) {
        // Ignore duplicate relationship warnings
      }
    }
  }

  return {
    importedEntities: entities.length,
    importedRelationships: relationships.length,
  };
}

/**
 * 3. IMPORT / EXPORT JSON MODEL
 */
export async function exportProjectAsJson(projectId) {
  const projRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  const project = projRes.rows[0] || { name: 'Project' };

  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);

  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    entities: entities.map((e) => ({
      name: e.name,
      type: e.type,
      description: e.description,
      pos_x: e.pos_x,
      pos_y: e.pos_y,
      attributes: e.attributes,
    })),
    relationships: relationships.map((r) => ({
      sourceEntityName: r.source_entity_name,
      targetEntityName: r.target_entity_name,
      cardinality: r.cardinality,
      name: r.name,
      description: r.description,
      isIdentifying: r.is_identifying,
      onDelete: r.on_delete,
    })),
  };
}

export async function importJsonIntoProject(projectId, jsonData, { overwrite = false } = {}) {
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

  if (!data || !Array.isArray(data.entities)) {
    throw new Error('Invalid ERD JSON format: "entities" array is required');
  }

  if (overwrite) {
    await query('DELETE FROM erd_entities WHERE project_id = $1', [projectId]);
  }

  const createdEntitiesMap = new Map();
  const positions = [];

  for (const ent of data.entities) {
    const created = await createEntity(projectId, {
      name: ent.name,
      type: ent.type || 'Strong',
      description: ent.description || '',
      initialAttributes: ent.attributes,
    });
    createdEntitiesMap.set(ent.name.toLowerCase(), created);

    if (ent.pos_x !== undefined && ent.pos_y !== undefined) {
      positions.push({ entityId: created.id, x: ent.pos_x, y: ent.pos_y });
    }
  }

  if (positions.length > 0) {
    await saveNodePositions(projectId, positions);
  }

  // Restore relationships
  if (Array.isArray(data.relationships)) {
    for (const rel of data.relationships) {
      const sourceEnt = createdEntitiesMap.get(rel.sourceEntityName?.toLowerCase());
      const targetEnt = createdEntitiesMap.get(rel.targetEntityName?.toLowerCase());

      if (sourceEnt && targetEnt && sourceEnt.id !== targetEnt.id) {
        try {
          await createRelationship(projectId, {
            sourceEntityId: sourceEnt.id,
            targetEntityId: targetEnt.id,
            cardinality: rel.cardinality || '1:M',
            name: rel.name || 'relates to',
            description: rel.description || '',
            isIdentifying: Boolean(rel.isIdentifying),
            onDelete: rel.onDelete || 'CASCADE',
          });
        } catch {
          // ignore duplicate
        }
      }
    }
  }

  return {
    importedEntities: data.entities.length,
    importedRelationships: (data.relationships || []).length,
  };
}

/**
 * 4. SEED TEMPLATES & PUBLIC COMMUNITY MODELS CATALOG
 */
export const STARTER_TEMPLATES = [
  {
    id: 'ecommerce',
    title: 'E-Commerce & Orders Platform',
    category: 'Commercial',
    icon: '🛒',
    description: 'Complete online retail database with Customers, Products, Categories, Orders, Weak OrderItems, and Payments.',
    entityCount: 6,
    relationshipCount: 5,
    entities: [
      {
        name: 'Customer',
        type: 'Strong',
        description: 'Store registered buyers and profiles',
        pos_x: 60,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'full_name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'email', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'phone', dataType: 'String', keyType: 'Normal', isNullable: true },
          { name: 'address', dataType: 'String', keyType: 'Normal', isNullable: true },
        ],
      },
      {
        name: 'Category',
        type: 'Strong',
        description: 'Product taxonomy & categories',
        pos_x: 400,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'slug', dataType: 'String', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'Product',
        type: 'Strong',
        description: 'Catalog item inventory and pricing',
        pos_x: 740,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'category_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'price', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
          { name: 'stock_quantity', dataType: 'Int', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'Order',
        type: 'Strong',
        description: 'Sales order transaction headers',
        pos_x: 60,
        pos_y: 380,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'customer_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'order_number', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'total_amount', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
          { name: 'status', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: "'pending'" },
          { name: 'order_date', dataType: 'Date', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'OrderItem',
        type: 'Weak',
        description: 'Weak entity line items identified by Order',
        pos_x: 400,
        pos_y: 380,
        attributes: [
          { name: 'order_id', dataType: 'Int', keyType: 'Composite', isNullable: false },
          { name: 'item_seq', dataType: 'Int', keyType: 'Composite', isNullable: false },
          { name: 'product_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'quantity', dataType: 'Int', keyType: 'Normal', isNullable: false },
          { name: 'unit_price', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'Payment',
        type: 'Strong',
        description: 'Payment receipts and gateways',
        pos_x: 740,
        pos_y: 380,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'order_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'amount', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
          { name: 'payment_method', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'payment_date', dataType: 'Date', keyType: 'Normal', isNullable: false },
        ],
      },
    ],
    relationships: [
      { sourceEntityName: 'Category', targetEntityName: 'Product', cardinality: '1:M', name: 'classifies' },
      { sourceEntityName: 'Customer', targetEntityName: 'Order', cardinality: '1:M', name: 'places' },
      { sourceEntityName: 'Order', targetEntityName: 'OrderItem', cardinality: '1:M', name: 'identifies', isIdentifying: true },
      { sourceEntityName: 'Product', targetEntityName: 'OrderItem', cardinality: '1:M', name: 'supplies' },
      { sourceEntityName: 'Order', targetEntityName: 'Payment', cardinality: '1:1', name: 'settled_by' },
    ],
  },

  {
    id: 'school',
    title: 'School & Academic Management System',
    category: 'Education',
    icon: '🎓',
    description: 'Academic relational model managing Departments, Instructors, Courses, Students, and Semester Enrollments.',
    entityCount: 5,
    relationshipCount: 4,
    entities: [
      {
        name: 'Department',
        type: 'Strong',
        description: 'Academic faculty department',
        pos_x: 60,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'dept_name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'office_room', dataType: 'String', keyType: 'Normal', isNullable: true },
        ],
      },
      {
        name: 'Instructor',
        type: 'Strong',
        description: 'Teaching staff and professors',
        pos_x: 400,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'department_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'full_name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'email', dataType: 'String', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'Course',
        type: 'Strong',
        description: 'Curriculum subjects and credit hours',
        pos_x: 740,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'instructor_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'course_code', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'title', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'credits', dataType: 'Int', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'Student',
        type: 'Strong',
        description: 'Enrolled pupils and undergraduates',
        pos_x: 60,
        pos_y: 380,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'student_number', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'full_name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'dob', dataType: 'Date', keyType: 'Normal', isNullable: true },
        ],
      },
      {
        name: 'Enrollment',
        type: 'Weak',
        description: 'Weak registration entity joining Student and Course with grades',
        pos_x: 400,
        pos_y: 380,
        attributes: [
          { name: 'student_id', dataType: 'Int', keyType: 'Composite', isNullable: false },
          { name: 'course_id', dataType: 'Int', keyType: 'Composite', isNullable: false },
          { name: 'semester', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'letter_grade', dataType: 'String', keyType: 'Normal', isNullable: true },
        ],
      },
    ],
    relationships: [
      { sourceEntityName: 'Department', targetEntityName: 'Instructor', cardinality: '1:M', name: 'employs' },
      { sourceEntityName: 'Instructor', targetEntityName: 'Course', cardinality: '1:M', name: 'teaches' },
      { sourceEntityName: 'Student', targetEntityName: 'Enrollment', cardinality: '1:M', name: 'enrolls_in', isIdentifying: true },
      { sourceEntityName: 'Course', targetEntityName: 'Enrollment', cardinality: '1:M', name: 'records' },
    ],
  },

  {
    id: 'rental',
    title: 'Vehicle & Equipment Rental System',
    category: 'Operations',
    icon: '🚗',
    description: 'Fleet and equipment reservations, leasing contracts, vehicle categories, and inspection logs.',
    entityCount: 5,
    relationshipCount: 4,
    entities: [
      {
        name: 'VehicleCategory',
        type: 'Strong',
        description: 'Fleet categories (SUV, Sedan, Truck)',
        pos_x: 60,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'category_name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'daily_rate', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'Vehicle',
        type: 'Strong',
        description: 'Fleet units, license plates, odometer',
        pos_x: 400,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'category_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'vin_number', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'plate_number', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'status', dataType: 'String', keyType: 'Normal', isNullable: false, defaultValue: "'available'" },
        ],
      },
      {
        name: 'Client',
        type: 'Strong',
        description: 'Drivers and leasing parties',
        pos_x: 740,
        pos_y: 80,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'driver_license_no', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'full_name', dataType: 'String', keyType: 'Normal', isNullable: false },
          { name: 'phone', dataType: 'String', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'RentalContract',
        type: 'Strong',
        description: 'Lease agreements, checkout and return dates',
        pos_x: 400,
        pos_y: 380,
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK', isNullable: false },
          { name: 'client_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'vehicle_id', dataType: 'Int', keyType: 'FK', isNullable: false },
          { name: 'start_date', dataType: 'Date', keyType: 'Normal', isNullable: false },
          { name: 'end_date', dataType: 'Date', keyType: 'Normal', isNullable: false },
          { name: 'total_charge', dataType: 'Decimal', keyType: 'Normal', isNullable: false },
        ],
      },
      {
        name: 'InspectionLog',
        type: 'Weak',
        description: 'Weak vehicle condition log before & after rental',
        pos_x: 740,
        pos_y: 380,
        attributes: [
          { name: 'contract_id', dataType: 'Int', keyType: 'Composite', isNullable: false },
          { name: 'log_seq', dataType: 'Int', keyType: 'Composite', isNullable: false },
          { name: 'odometer_reading', dataType: 'Int', keyType: 'Normal', isNullable: false },
          { name: 'damage_notes', dataType: 'Text', keyType: 'Normal', isNullable: true },
          { name: 'fuel_level_percent', dataType: 'Int', keyType: 'Normal', isNullable: false },
        ],
      },
    ],
    relationships: [
      { sourceEntityName: 'VehicleCategory', targetEntityName: 'Vehicle', cardinality: '1:M', name: 'classifies' },
      { sourceEntityName: 'Vehicle', targetEntityName: 'RentalContract', cardinality: '1:M', name: 'leased_in' },
      { sourceEntityName: 'Client', targetEntityName: 'RentalContract', cardinality: '1:M', name: 'signs' },
      { sourceEntityName: 'RentalContract', targetEntityName: 'InspectionLog', cardinality: '1:M', name: 'documents', isIdentifying: true },
    ],
  },
];

export const PUBLIC_COMMUNITY_MODELS = [
  {
    id: 'hospital',
    title: 'Hospital & Healthcare Records',
    author: 'Medical Informatics Lab',
    badge: 'Popular',
    icon: '🏥',
    description: 'Patient admissions, medical doctors, prescriptions, and diagnosis clinical notes.',
    entityCount: 4,
    entities: [
      {
        name: 'Doctor',
        type: 'Strong',
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK' },
          { name: 'name', dataType: 'String', keyType: 'Normal' },
          { name: 'specialty', dataType: 'String', keyType: 'Normal' },
        ],
      },
      {
        name: 'Patient',
        type: 'Strong',
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK' },
          { name: 'medical_record_no', dataType: 'String', keyType: 'Normal' },
          { name: 'name', dataType: 'String', keyType: 'Normal' },
          { name: 'blood_type', dataType: 'String', keyType: 'Normal' },
        ],
      },
      {
        name: 'Appointment',
        type: 'Strong',
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK' },
          { name: 'doctor_id', dataType: 'Int', keyType: 'FK' },
          { name: 'patient_id', dataType: 'Int', keyType: 'FK' },
          { name: 'scheduled_at', dataType: 'Date', keyType: 'Normal' },
        ],
      },
      {
        name: 'Prescription',
        type: 'Weak',
        attributes: [
          { name: 'appointment_id', dataType: 'Int', keyType: 'Composite' },
          { name: 'medication_name', dataType: 'String', keyType: 'Composite' },
          { name: 'dosage', dataType: 'String', keyType: 'Normal' },
        ],
      },
    ],
    relationships: [
      { sourceEntityName: 'Doctor', targetEntityName: 'Appointment', cardinality: '1:M', name: 'attends' },
      { sourceEntityName: 'Patient', targetEntityName: 'Appointment', cardinality: '1:M', name: 'schedules' },
      { sourceEntityName: 'Appointment', targetEntityName: 'Prescription', cardinality: '1:M', name: 'prescribes', isIdentifying: true },
    ],
  },
  {
    id: 'hotel',
    title: 'Hotel & Resort Booking Engine',
    author: 'Hospitality Tech Group',
    badge: 'Enterprise',
    icon: '🏨',
    description: 'Room types, individual guest rooms, reservations, and checkout billing statements.',
    entityCount: 4,
    entities: [
      {
        name: 'RoomType',
        type: 'Strong',
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK' },
          { name: 'type_name', dataType: 'String', keyType: 'Normal' },
          { name: 'nightly_rate', dataType: 'Decimal', keyType: 'Normal' },
        ],
      },
      {
        name: 'Room',
        type: 'Strong',
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK' },
          { name: 'room_type_id', dataType: 'Int', keyType: 'FK' },
          { name: 'room_number', dataType: 'String', keyType: 'Normal' },
        ],
      },
      {
        name: 'Guest',
        type: 'Strong',
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK' },
          { name: 'passport_number', dataType: 'String', keyType: 'Normal' },
          { name: 'full_name', dataType: 'String', keyType: 'Normal' },
        ],
      },
      {
        name: 'Reservation',
        type: 'Strong',
        attributes: [
          { name: 'id', dataType: 'Int', keyType: 'PK' },
          { name: 'guest_id', dataType: 'Int', keyType: 'FK' },
          { name: 'room_id', dataType: 'Int', keyType: 'FK' },
          { name: 'check_in', dataType: 'Date', keyType: 'Normal' },
          { name: 'check_out', dataType: 'Date', keyType: 'Normal' },
        ],
      },
    ],
    relationships: [
      { sourceEntityName: 'RoomType', targetEntityName: 'Room', cardinality: '1:M', name: 'categorizes' },
      { sourceEntityName: 'Guest', targetEntityName: 'Reservation', cardinality: '1:M', name: 'books' },
      { sourceEntityName: 'Room', targetEntityName: 'Reservation', cardinality: '1:M', name: 'reserved_in' },
    ],
  },
];

export async function applyTemplate(projectId, templateId, { overwrite = false } = {}) {
  const allTemplates = [...STARTER_TEMPLATES, ...PUBLIC_COMMUNITY_MODELS];
  const template = allTemplates.find((t) => t.id === templateId);

  if (!template) {
    throw new Error(`Template "${templateId}" not found in catalog`);
  }

  return await importJsonIntoProject(projectId, template, { overwrite });
}

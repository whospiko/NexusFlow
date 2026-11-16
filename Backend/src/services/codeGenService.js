import { getProjectEntities, getProjectRelationships } from './erdService.js';
import { query } from '../config/db.js';

/**
 * Pure SQL Code & DDL Generation Service
 * Supported Dialects: PostgreSQL, MySQL, SQL Server, Oracle, SQLite
 * ORM Schemas: Prisma, TypeORM (TypeScript), Sequelize (TypeScript)
 */

// Helper to sanitize identifiers
function sanitizeIdent(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function pascalCase(str) {
  return (str || '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function camelCase(str) {
  const p = pascalCase(str);
  return p ? p[0].toLowerCase() + p.slice(1) : '';
}

/**
 * 1. SQL DDL GENERATOR (Multi-Dialect)
 */
export function generateSqlByDialect(entities, relationships, dialect = 'postgresql') {
  const d = dialect.toLowerCase();

  switch (d) {
    case 'mysql':
      return generateMySqlDdl(entities, relationships);
    case 'sqlserver':
    case 'mssql':
      return generateSqlServerDdl(entities, relationships);
    case 'oracle':
      return generateOracleDdl(entities, relationships);
    case 'sqlite':
      return generateSqliteDdl(entities, relationships);
    case 'postgresql':
    default:
      return generatePostgreSqlDdl(entities, relationships);
  }
}

// 1.1 PostgreSQL DDL
function generatePostgreSqlDdl(entities, relationships) {
  const lines = [
    `-- ========================================================`,
    `-- PostgreSQL Relational DDL (3NF)`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- ========================================================\n`
  ];

  for (const ent of [...entities].reverse()) {
    lines.push(`DROP TABLE IF EXISTS ${sanitizeIdent(ent.name)} CASCADE;`);
  }
  lines.push('');

  for (const ent of entities) {
    const tableName = sanitizeIdent(ent.name);
    lines.push(`-- Entity: ${ent.name} (${ent.type})`);
    if (ent.description) lines.push(`-- Description: ${ent.description}`);
    lines.push(`CREATE TABLE ${tableName} (`);

    const colDefs = [];
    const pkCols = [];

    for (const attr of ent.attributes) {
      const colName = sanitizeIdent(attr.name);
      let pgType = 'VARCHAR(255)';
      const t = (attr.dataType || '').toLowerCase();
      if (t.includes('int')) pgType = 'INTEGER';
      else if (t.includes('date') || t.includes('time')) pgType = 'TIMESTAMP WITH TIME ZONE';
      else if (t.includes('bool')) pgType = 'BOOLEAN';
      else if (t.includes('decimal') || t.includes('float') || t.includes('num')) pgType = 'NUMERIC(12,2)';
      else if (t.includes('text')) pgType = 'TEXT';

      let def = `    ${colName.padEnd(20)} ${pgType}`;
      if (attr.keyType === 'PK' || attr.keyType === 'Composite') {
        pkCols.push(colName);
        def += ' NOT NULL';
      } else if (!attr.isNullable) {
        def += ' NOT NULL';
      }

      if (attr.defaultValue) def += ` DEFAULT ${attr.defaultValue}`;
      colDefs.push(def);
    }

    if (pkCols.length > 0) {
      colDefs.push(`    PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // FK Constraints
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const refEnt = entities.find((e) => e.id === fk.refEntityId);
      const refAttr = refEnt?.attributes.find((a) => a.id === fk.refAttributeId) || { name: 'id' };
      if (refEnt) {
        const colName = sanitizeIdent(fk.name);
        const refTable = sanitizeIdent(refEnt.name);
        const refCol = sanitizeIdent(refAttr.name);
        colDefs.push(`    CONSTRAINT fk_${tableName}_${colName} FOREIGN KEY (${colName}) REFERENCES ${refTable}(${refCol}) ON DELETE CASCADE`);
      }
    }

    lines.push(colDefs.join(',\n'));
    lines.push(`);\n`);
  }

  // Performance Indexes
  lines.push(`-- Foreign Key Performance Indexes`);
  for (const ent of entities) {
    const tableName = sanitizeIdent(ent.name);
    for (const fk of ent.attributes.filter((a) => a.keyType === 'FK')) {
      const colName = sanitizeIdent(fk.name);
      lines.push(`CREATE INDEX idx_${tableName}_${colName} ON ${tableName}(${colName});`);
    }
  }

  return lines.join('\n');
}

// 1.2 MySQL DDL
function generateMySqlDdl(entities, relationships) {
  const lines = [
    `-- ========================================================`,
    `-- MySQL 8.0+ Relational DDL (InnoDB)`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- ========================================================\n`,
    `SET FOREIGN_KEY_CHECKS = 0;\n`
  ];

  for (const ent of entities) {
    lines.push(`DROP TABLE IF EXISTS \`${sanitizeIdent(ent.name)}\`;`);
  }
  lines.push(`SET FOREIGN_KEY_CHECKS = 1;\n`);

  for (const ent of entities) {
    const tableName = sanitizeIdent(ent.name);
    lines.push(`CREATE TABLE \`${tableName}\` (`);

    const colDefs = [];
    const pkCols = [];

    for (const attr of ent.attributes) {
      const colName = sanitizeIdent(attr.name);
      let myType = 'VARCHAR(255)';
      const t = (attr.dataType || '').toLowerCase();
      if (t.includes('int')) myType = 'INT';
      else if (t.includes('date') || t.includes('time')) myType = 'DATETIME';
      else if (t.includes('bool')) myType = 'TINYINT(1)';
      else if (t.includes('decimal') || t.includes('float') || t.includes('num')) myType = 'DECIMAL(12,2)';
      else if (t.includes('text')) myType = 'TEXT';

      let def = `    \`${colName}\` ${myType}`;
      if (attr.keyType === 'PK') {
        if (t.includes('int')) def += ' AUTO_INCREMENT';
        pkCols.push(`\`${colName}\``);
        def += ' NOT NULL';
      } else if (attr.keyType === 'Composite') {
        pkCols.push(`\`${colName}\``);
        def += ' NOT NULL';
      } else if (!attr.isNullable) {
        def += ' NOT NULL';
      }

      if (attr.defaultValue) def += ` DEFAULT ${attr.defaultValue}`;
      colDefs.push(def);
    }

    if (pkCols.length > 0) {
      colDefs.push(`    PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // FK Constraints
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const refEnt = entities.find((e) => e.id === fk.refEntityId);
      const refAttr = refEnt?.attributes.find((a) => a.id === fk.refAttributeId) || { name: 'id' };
      if (refEnt) {
        const colName = sanitizeIdent(fk.name);
        const refTable = sanitizeIdent(refEnt.name);
        const refCol = sanitizeIdent(refAttr.name);
        colDefs.push(`    CONSTRAINT \`fk_${tableName}_${colName}\` FOREIGN KEY (\`${colName}\`) REFERENCES \`${refTable}\` (\`${refCol}\`) ON DELETE CASCADE`);
      }
    }

    lines.push(colDefs.join(',\n'));
    lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
  }

  return lines.join('\n');
}

// 1.3 SQL Server (T-SQL) DDL
function generateSqlServerDdl(entities, relationships) {
  const lines = [
    `-- ========================================================`,
    `-- Microsoft SQL Server (T-SQL)`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- ========================================================\n`
  ];

  for (const ent of [...entities].reverse()) {
    const tableName = sanitizeIdent(ent.name);
    lines.push(`IF OBJECT_ID('dbo.[${tableName}]', 'U') IS NOT NULL DROP TABLE dbo.[${tableName}];`);
  }
  lines.push('GO\n');

  for (const ent of entities) {
    const tableName = sanitizeIdent(ent.name);
    lines.push(`CREATE TABLE dbo.[${tableName}] (`);

    const colDefs = [];
    const pkCols = [];

    for (const attr of ent.attributes) {
      const colName = sanitizeIdent(attr.name);
      let msType = 'NVARCHAR(255)';
      const t = (attr.dataType || '').toLowerCase();
      if (t.includes('int')) msType = 'INT';
      else if (t.includes('date') || t.includes('time')) msType = 'DATETIME2';
      else if (t.includes('bool')) msType = 'BIT';
      else if (t.includes('decimal') || t.includes('float') || t.includes('num')) msType = 'DECIMAL(12,2)';
      else if (t.includes('text')) msType = 'NVARCHAR(MAX)';

      let def = `    [${colName}] ${msType}`;
      if (attr.keyType === 'PK' && t.includes('int')) {
        def += ' IDENTITY(1,1)';
      }
      if (attr.keyType === 'PK' || attr.keyType === 'Composite' || !attr.isNullable) {
        def += ' NOT NULL';
      }

      if (attr.keyType === 'PK' || attr.keyType === 'Composite') {
        pkCols.push(`[${colName}]`);
      }

      if (attr.defaultValue) def += ` DEFAULT ${attr.defaultValue}`;
      colDefs.push(def);
    }

    if (pkCols.length > 0) {
      colDefs.push(`    CONSTRAINT [PK_${tableName}] PRIMARY KEY CLUSTERED (${pkCols.join(', ')})`);
    }

    // FK Constraints
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const refEnt = entities.find((e) => e.id === fk.refEntityId);
      const refAttr = refEnt?.attributes.find((a) => a.id === fk.refAttributeId) || { name: 'id' };
      if (refEnt) {
        const colName = sanitizeIdent(fk.name);
        const refTable = sanitizeIdent(refEnt.name);
        const refCol = sanitizeIdent(refAttr.name);
        colDefs.push(`    CONSTRAINT [FK_${tableName}_${colName}] FOREIGN KEY ([${colName}]) REFERENCES dbo.[${refTable}] ([${refCol}]) ON DELETE CASCADE`);
      }
    }

    lines.push(colDefs.join(',\n'));
    lines.push(`);\nGO\n`);
  }

  return lines.join('\n');
}

// 1.4 Oracle (PL/SQL) DDL
function generateOracleDdl(entities, relationships) {
  const lines = [
    `-- ========================================================`,
    `-- Oracle Database (PL/SQL)`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- ========================================================\n`
  ];

  for (const ent of [...entities].reverse()) {
    const tableName = sanitizeIdent(ent.name).toUpperCase();
    lines.push(`BEGIN EXECUTE IMMEDIATE 'DROP TABLE "${tableName}" CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;\n/`);
  }
  lines.push('');

  for (const ent of entities) {
    const tableName = sanitizeIdent(ent.name).toUpperCase();
    lines.push(`CREATE TABLE "${tableName}" (`);

    const colDefs = [];
    const pkCols = [];

    for (const attr of ent.attributes) {
      const colName = sanitizeIdent(attr.name).toUpperCase();
      let oraType = 'VARCHAR2(255)';
      const t = (attr.dataType || '').toLowerCase();
      if (t.includes('int')) oraType = 'NUMBER(10)';
      else if (t.includes('date') || t.includes('time')) oraType = 'TIMESTAMP WITH TIME ZONE';
      else if (t.includes('bool')) oraType = 'NUMBER(1)';
      else if (t.includes('decimal') || t.includes('float') || t.includes('num')) oraType = 'NUMBER(12,2)';
      else if (t.includes('text')) oraType = 'CLOB';

      let def = `    "${colName}" ${oraType}`;
      if (attr.keyType === 'PK' && t.includes('int')) {
        def += ' GENERATED BY DEFAULT AS IDENTITY';
      }
      if (attr.keyType === 'PK' || attr.keyType === 'Composite' || !attr.isNullable) {
        def += ' NOT NULL';
      }

      if (attr.keyType === 'PK' || attr.keyType === 'Composite') {
        pkCols.push(`"${colName}"`);
      }

      colDefs.push(def);
    }

    if (pkCols.length > 0) {
      colDefs.push(`    CONSTRAINT "PK_${tableName}" PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // FK Constraints
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const refEnt = entities.find((e) => e.id === fk.refEntityId);
      const refAttr = refEnt?.attributes.find((a) => a.id === fk.refAttributeId) || { name: 'id' };
      if (refEnt) {
        const colName = sanitizeIdent(fk.name).toUpperCase();
        const refTable = sanitizeIdent(refEnt.name).toUpperCase();
        const refCol = sanitizeIdent(refAttr.name).toUpperCase();
        colDefs.push(`    CONSTRAINT "FK_${tableName}_${colName}" FOREIGN KEY ("${colName}") REFERENCES "${refTable}" ("${refCol}") ON DELETE CASCADE`);
      }
    }

    lines.push(colDefs.join(',\n'));
    lines.push(`);\n/`);
  }

  return lines.join('\n');
}

// 1.5 SQLite DDL
function generateSqliteDdl(entities, relationships) {
  const lines = [
    `-- ========================================================`,
    `-- SQLite 3 DDL`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- ========================================================\n`,
    `PRAGMA foreign_keys = ON;\n`
  ];

  for (const ent of [...entities].reverse()) {
    lines.push(`DROP TABLE IF EXISTS "${sanitizeIdent(ent.name)}";`);
  }
  lines.push('');

  for (const ent of entities) {
    const tableName = sanitizeIdent(ent.name);
    lines.push(`CREATE TABLE "${tableName}" (`);

    const colDefs = [];
    const pkCols = [];
    const singleIntPk = ent.attributes.filter((a) => a.keyType === 'PK');

    for (const attr of ent.attributes) {
      const colName = sanitizeIdent(attr.name);
      let sqType = 'TEXT';
      const t = (attr.dataType || '').toLowerCase();
      if (t.includes('int')) sqType = 'INTEGER';
      else if (t.includes('decimal') || t.includes('float') || t.includes('num')) sqType = 'REAL';
      else if (t.includes('bool')) sqType = 'INTEGER';

      let def = `    "${colName}" ${sqType}`;
      if (attr.keyType === 'PK' && singleIntPk.length === 1 && t.includes('int')) {
        def += ' PRIMARY KEY AUTOINCREMENT';
      } else {
        if (attr.keyType === 'PK' || attr.keyType === 'Composite') {
          pkCols.push(`"${colName}"`);
        }
        if (!attr.isNullable) def += ' NOT NULL';
      }

      if (attr.defaultValue) def += ` DEFAULT ${attr.defaultValue}`;
      colDefs.push(def);
    }

    // Composite or non-autoincrement PK
    if (pkCols.length > 0 && (singleIntPk.length !== 1 || !singleIntPk[0].dataType.toLowerCase().includes('int'))) {
      colDefs.push(`    PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // FK Constraints
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const refEnt = entities.find((e) => e.id === fk.refEntityId);
      const refAttr = refEnt?.attributes.find((a) => a.id === fk.refAttributeId) || { name: 'id' };
      if (refEnt) {
        const colName = sanitizeIdent(fk.name);
        const refTable = sanitizeIdent(refEnt.name);
        const refCol = sanitizeIdent(refAttr.name);
        colDefs.push(`    FOREIGN KEY ("${colName}") REFERENCES "${refTable}" ("${refCol}") ON DELETE CASCADE`);
      }
    }

    lines.push(colDefs.join(',\n'));
    lines.push(`);\n`);
  }

  return lines.join('\n');
}

/**
 * 2. PRISMA SCHEMA GENERATOR
 */
export function generatePrismaSchema(entities, relationships) {
  const lines = [
    `// ========================================================`,
    `// Prisma Schema (schema.prisma)`,
    `// Generated on: ${new Date().toISOString()}`,
    `// ========================================================\n`,
    `generator client {`,
    `  provider = "prisma-client-js"`,
    `}\n`,
    `datasource db {`,
    `  provider = "postgresql"`,
    `  url      = env("DATABASE_URL")`,
    `}\n`
  ];

  // Helper map for relations
  const entityMap = new Map();
  entities.forEach((e) => entityMap.set(e.id, e));

  for (const ent of entities) {
    const modelName = pascalCase(ent.name);
    lines.push(`model ${modelName} {`);

    const fields = [];
    const compositePks = [];

    // Fields
    for (const attr of ent.attributes) {
      const fieldName = camelCase(attr.name);
      let pType = 'String';
      const t = (attr.dataType || '').toLowerCase();
      if (t.includes('int')) pType = 'Int';
      else if (t.includes('date') || t.includes('time')) pType = 'DateTime';
      else if (t.includes('bool')) pType = 'Boolean';
      else if (t.includes('decimal') || t.includes('float') || t.includes('num')) pType = 'Decimal';

      const optional = attr.isNullable ? '?' : '';
      let directives = '';

      if (attr.keyType === 'PK') {
        directives = ' @id';
        if (pType === 'Int') directives += ' @default(autoincrement())';
      } else if (attr.keyType === 'Composite') {
        compositePks.push(fieldName);
      }

      if (attr.defaultValue) {
        if (attr.defaultValue.toLowerCase() === 'current_timestamp' || attr.defaultValue.toLowerCase() === 'now()') {
          directives += ' @default(now())';
        } else {
          directives += ` @default(${attr.defaultValue})`;
        }
      }

      fields.push(`  ${fieldName.padEnd(16)} ${pType}${optional}${directives}`);
    }

    // Outgoing Relations (Foreign Keys pointing to parent)
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const parentEnt = entityMap.get(fk.refEntityId);
      if (parentEnt) {
        const parentModel = pascalCase(parentEnt.name);
        const refAttr = parentEnt.attributes.find((a) => a.id === fk.refAttributeId) || { name: 'id' };
        const relationFieldName = camelCase(parentEnt.name);
        const fkFieldName = camelCase(fk.name);
        const refFieldName = camelCase(refAttr.name);

        fields.push(`  ${relationFieldName.padEnd(16)} ${parentModel}${fk.isNullable ? '?' : ''} @relation(fields: [${fkFieldName}], references: [${refFieldName}], onDelete: Cascade)`);
      }
    }

    // Incoming Relations (Child models referencing this parent)
    for (const otherEnt of entities) {
      if (otherEnt.id === ent.id) continue;
      const childFks = otherEnt.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId === ent.id);
      for (const cFk of childFks) {
        const childModel = pascalCase(otherEnt.name);
        const childRelationField = camelCase(otherEnt.name) + 's';
        fields.push(`  ${childRelationField.padEnd(16)} ${childModel}[]`);
      }
    }

    if (compositePks.length > 1) {
      fields.push(`  @@id([${compositePks.join(', ')}])`);
    }

    lines.push(fields.join('\n'));
    lines.push(`  @@map("${sanitizeIdent(ent.name)}")`);
    lines.push(`}\n`);
  }

  return lines.join('\n');
}

/**
 * 3. TYPEORM MODELS GENERATOR (TypeScript)
 */
export function generateTypeOrmModels(entities, relationships) {
  const lines = [
    `// ========================================================`,
    `// TypeORM TypeScript Entity Models`,
    `// Generated on: ${new Date().toISOString()}`,
    `// ========================================================\n`,
    `import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';\n`
  ];

  for (const ent of entities) {
    const className = pascalCase(ent.name);
    const tableName = sanitizeIdent(ent.name);

    lines.push(`@Entity('${tableName}')`);
    lines.push(`export class ${className} {`);

    for (const attr of ent.attributes) {
      const propName = camelCase(attr.name);
      const t = (attr.dataType || '').toLowerCase();
      let tsType = 'string';
      let ormType = `'varchar'`;

      if (t.includes('int')) {
        tsType = 'number';
        ormType = `'int'`;
      } else if (t.includes('date') || t.includes('time')) {
        tsType = 'Date';
        ormType = `'timestamp'`;
      } else if (t.includes('bool')) {
        tsType = 'boolean';
        ormType = `'boolean'`;
      } else if (t.includes('decimal') || t.includes('float') || t.includes('num')) {
        tsType = 'number';
        ormType = `'decimal'`;
      }

      if (attr.keyType === 'PK') {
        if (tsType === 'number') {
          lines.push(`  @PrimaryGeneratedColumn()`);
        } else {
          lines.push(`  @PrimaryColumn()`);
        }
      } else if (attr.keyType === 'Composite') {
        lines.push(`  @PrimaryColumn()`);
      } else {
        lines.push(`  @Column({ type: ${ormType}, nullable: ${Boolean(attr.isNullable)} })`);
      }

      lines.push(`  ${propName}${attr.isNullable ? '?' : '!'}: ${tsType};\n`);
    }

    // ManyToOne Relations
    const fkAttrs = ent.attributes.filter((a) => a.keyType === 'FK' && a.refEntityId);
    for (const fk of fkAttrs) {
      const parentEnt = entities.find((e) => e.id === fk.refEntityId);
      if (parentEnt) {
        const parentClass = pascalCase(parentEnt.name);
        const relProp = camelCase(parentEnt.name);
        lines.push(`  @ManyToOne(() => ${parentClass}, { onDelete: 'CASCADE' })`);
        lines.push(`  @JoinColumn({ name: '${sanitizeIdent(fk.name)}' })`);
        lines.push(`  ${relProp}?: ${parentClass};\n`);
      }
    }

    lines.push(`}\n`);
  }

  return lines.join('\n');
}

/**
 * 4. SEQUELIZE MODELS GENERATOR (TypeScript)
 */
export function generateSequelizeModels(entities, relationships) {
  const lines = [
    `// ========================================================`,
    `// Sequelize TypeScript Models`,
    `// Generated on: ${new Date().toISOString()}`,
    `// ========================================================\n`,
    `import { Model, DataTypes, Sequelize } from 'sequelize';\n`
  ];

  for (const ent of entities) {
    const className = pascalCase(ent.name);
    const tableName = sanitizeIdent(ent.name);

    lines.push(`export class ${className} extends Model {}`);
    lines.push(`export function init${className}(sequelize: Sequelize) {`);
    lines.push(`  ${className}.init({`);

    const colDefs = [];
    for (const attr of ent.attributes) {
      const colName = sanitizeIdent(attr.name);
      const t = (attr.dataType || '').toLowerCase();
      let dt = 'DataTypes.STRING';
      if (t.includes('int')) dt = 'DataTypes.INTEGER';
      else if (t.includes('date') || t.includes('time')) dt = 'DataTypes.DATE';
      else if (t.includes('bool')) dt = 'DataTypes.BOOLEAN';
      else if (t.includes('decimal') || t.includes('float') || t.includes('num')) dt = 'DataTypes.DECIMAL(12, 2)';

      const props = [`type: ${dt}`];
      if (attr.keyType === 'PK') {
        props.push('primaryKey: true');
        if (t.includes('int')) props.push('autoIncrement: true');
      } else if (attr.keyType === 'Composite') {
        props.push('primaryKey: true');
      }
      props.push(`allowNull: ${Boolean(attr.isNullable)}`);

      colDefs.push(`    ${colName}: { ${props.join(', ')} }`);
    }

    lines.push(colDefs.join(',\n'));
    lines.push(`  }, {`);
    lines.push(`    sequelize,`);
    lines.push(`    tableName: '${tableName}',`);
    lines.push(`    timestamps: true,`);
    lines.push(`  });`);
    lines.push(`}\n`);
  }

  return lines.join('\n');
}

/**
 * Fetch and Generate all artifacts for a project
 */
export async function generateProjectCode(projectId, dialect = 'postgresql') {
  const entities = await getProjectEntities(projectId);
  const relationships = await getProjectRelationships(projectId);

  const sql = generateSqlByDialect(entities, relationships, dialect);
  const prisma = generatePrismaSchema(entities, relationships);
  const typeorm = generateTypeOrmModels(entities, relationships);
  const sequelize = generateSequelizeModels(entities, relationships);

  return {
    projectId,
    dialect,
    sql,
    prisma,
    typeorm,
    sequelize,
    totalEntities: entities.length,
    totalRelationships: relationships.length,
  };
}


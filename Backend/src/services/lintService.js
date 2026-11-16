import * as erdService from './erdService.js';

// Reserved SQL-92 / SQL:2016 Keywords that cause parsing collisions if unquoted
const SQL_RESERVED_KEYWORDS = new Set([
  'user', 'users', 'order', 'orders', 'group', 'table', 'select', 'where', 'from',
  'join', 'left', 'right', 'inner', 'outer', 'create', 'drop', 'alter', 'index',
  'check', 'default', 'null', 'not', 'and', 'or', 'case', 'when', 'then', 'else',
  'end', 'limit', 'offset', 'view', 'grant', 'revoke', 'primary', 'foreign', 'key',
  'references', 'distinct', 'having', 'into', 'values', 'update', 'delete', 'insert',
]);

/**
 * Run Schema Linting and Best Practice Rules on project ERD
 */
export async function lintProjectSchema(projectId) {
  const entities = await erdService.getProjectEntities(projectId);
  const relationships = await erdService.getProjectRelationships(projectId);

  const issues = [];
  const passedRules = [];

  // Helper to add issues
  const reportIssue = ({
    ruleId,
    ruleName,
    category, // 'Naming' | 'Integrity' | 'Performance' | 'Standards'
    severity, // 'error' | 'warning' | 'info'
    entityId = null,
    entityName = null,
    attributeId = null,
    attributeName = null,
    message,
    suggestion,
    autoFixable = false,
  }) => {
    issues.push({
      id: `${ruleId}-${entityName || 'global'}-${attributeName || ''}-${issues.length}`,
      ruleId,
      ruleName,
      category,
      severity,
      entityId,
      entityName,
      attributeId,
      attributeName,
      message,
      suggestion,
      autoFixable,
    });
  };

  // Build entity lookup map
  const entityMap = new Map(entities.map((e) => [e.name.toLowerCase(), e]));

  // RULE 1: Anti-Pattern — Tables Without Primary Key (CRITICAL)
  let missingPkCount = 0;
  entities.forEach((entity) => {
    const pks = (entity.attributes || []).filter(
      (a) => a.keyType === 'PK' || a.keyType === 'Composite'
    );
    if (pks.length === 0) {
      missingPkCount++;
      reportIssue({
        ruleId: 'LINT_MISSING_PK',
        ruleName: 'Table Missing Primary Key',
        category: 'Integrity',
        severity: 'error',
        entityId: entity.id,
        entityName: entity.name,
        message: `Table '${entity.name}' has no Primary Key defined.`,
        suggestion: `Add an 'id' column with data type BIGINT / SERIAL and key type 'PK'. Every relational table requires a unique identifier.`,
        autoFixable: true,
      });
    }
  });
  if (missingPkCount === 0 && entities.length > 0) {
    passedRules.push('All tables have valid Primary Keys defined.');
  }

  // RULE 2: Naming Convention — Table Name Should Be Plural
  let singularTableCount = 0;
  entities.forEach((entity) => {
    const name = entity.name.trim();
    // Simple heuristic: if doesn't end with 's' or 'ies' or 'data', flag suggestion
    if (!name.endsWith('s') && !name.endsWith('S') && !name.toLowerCase().endsWith('data')) {
      singularTableCount++;
      reportIssue({
        ruleId: 'LINT_PLURAL_TABLE_NAME',
        ruleName: 'Table Name Should Be Plural',
        category: 'Naming',
        severity: 'info',
        entityId: entity.id,
        entityName: entity.name,
        message: `Table name '${name}' is singular. Database convention recommends plural table names.`,
        suggestion: `Consider renaming '${name}' to '${name}s' (e.g. 'Customer' -> 'Customers', 'Invoice' -> 'Invoices').`,
        autoFixable: false,
      });
    }
  });
  if (singularTableCount === 0 && entities.length > 0) {
    passedRules.push('Table names follow plural convention.');
  }

  // RULE 3: Naming Convention — Primary Keys Should End with ID
  entities.forEach((entity) => {
    const pks = (entity.attributes || []).filter((a) => a.keyType === 'PK');
    pks.forEach((pk) => {
      const pkName = pk.name.toLowerCase();
      if (pkName !== 'id' && !pkName.endsWith('_id') && !pkName.endsWith('id')) {
        reportIssue({
          ruleId: 'LINT_PK_NAMING',
          ruleName: 'Primary Key Naming Convention',
          category: 'Naming',
          severity: 'warning',
          entityId: entity.id,
          entityName: entity.name,
          attributeId: pk.id,
          attributeName: pk.name,
          message: `Primary key '${pk.name}' in '${entity.name}' does not follow standard ID naming.`,
          suggestion: `Rename to 'id' or '${entity.name.toLowerCase()}_id' for standard ORM/SQL mapping consistency.`,
        });
      }
    });
  });

  // RULE 4: SQL Reserved Keyword Collisions
  entities.forEach((entity) => {
    if (SQL_RESERVED_KEYWORDS.has(entity.name.toLowerCase())) {
      reportIssue({
        ruleId: 'LINT_RESERVED_KEYWORD_TABLE',
        ruleName: 'Table Name Collides with SQL Reserved Keyword',
        category: 'Standards',
        severity: 'warning',
        entityId: entity.id,
        entityName: entity.name,
        message: `Table name '${entity.name}' is an SQL reserved keyword.`,
        suggestion: `Rename table (e.g. 'app_${entity.name.toLowerCase()}' or 'users' instead of 'user') to prevent SQL syntax errors in raw queries.`,
      });
    }

    (entity.attributes || []).forEach((attr) => {
      if (SQL_RESERVED_KEYWORDS.has(attr.name.toLowerCase())) {
        reportIssue({
          ruleId: 'LINT_RESERVED_KEYWORD_COLUMN',
          ruleName: 'Column Name Collides with SQL Reserved Keyword',
          category: 'Standards',
          severity: 'info',
          entityId: entity.id,
          entityName: entity.name,
          attributeId: attr.id,
          attributeName: attr.name,
          message: `Column '${attr.name}' in table '${entity.name}' is a reserved SQL keyword.`,
          suggestion: `Consider renaming to a qualified identifier like '${attr.name}_date' or '${attr.name}_value' to avoid requiring escaped double quotes in SQL.`,
        });
      }
    });
  });

  // RULE 5: Anti-Pattern — Wide Tables (> 20 columns)
  entities.forEach((entity) => {
    const colCount = (entity.attributes || []).length;
    if (colCount > 20) {
      reportIssue({
        ruleId: 'LINT_WIDE_TABLE',
        ruleName: 'Wide Table Anti-Pattern (>20 columns)',
        category: 'Performance',
        severity: 'warning',
        entityId: entity.id,
        entityName: entity.name,
        message: `Table '${entity.name}' has ${colCount} columns. Tables with >20 columns often cause performance penalties and indicate missing normalization.`,
        suggestion: `Extract rarely accessed or 1-to-1 extension attributes into a dedicated detail table (e.g. '${entity.name}_Profile' or '${entity.name}_Metadata').`,
      });
    }
  });

  // RULE 6: ISO/SQL Standards — Financial / Monetary Floating Point Precision Error
  entities.forEach((entity) => {
    (entity.attributes || []).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const dt = (attr.dataType || '').toLowerCase();
      const isMonetaryName = /(price|amount|balance|salary|cost|tax|total|fee|revenue|subtotal)/i.test(name);
      const isFloatType = dt === 'float' || dt === 'double' || dt === 'real';

      if (isMonetaryName && isFloatType) {
        reportIssue({
          ruleId: 'LINT_FLOAT_CURRENCY',
          ruleName: 'Floating Point Used for Financial Currency',
          category: 'Standards',
          severity: 'error',
          entityId: entity.id,
          entityName: entity.name,
          attributeId: attr.id,
          attributeName: attr.name,
          message: `Column '${attr.name}' uses floating-point '${attr.dataType}', which suffers from rounding errors in financial transactions.`,
          suggestion: `Change data type to 'DECIMAL(15,2)' or 'NUMERIC' for exact fixed-point arithmetic as required by accounting standards.`,
          autoFixable: true,
        });
      }
    });
  });

  // RULE 7: Missing Foreign Key Index Recommendation
  entities.forEach((entity) => {
    (entity.attributes || []).forEach((attr) => {
      if (attr.keyType === 'FK') {
        reportIssue({
          ruleId: 'LINT_FK_INDEX',
          ruleName: 'Foreign Key Column Missing Index Recommendation',
          category: 'Performance',
          severity: 'info',
          entityId: entity.id,
          entityName: entity.name,
          attributeId: attr.id,
          attributeName: attr.name,
          message: `Foreign key '${attr.name}' in '${entity.name}' should have an index to accelerate JOIN operations.`,
          suggestion: `Ensure a B-tree index 'idx_${entity.name.toLowerCase()}_${attr.name.toLowerCase()}' is created.`,
        });
      }
    });
  });

  // RULE 8: Circular Foreign Key Dependencies
  const relPairMap = new Map();
  relationships.forEach((rel) => {
    const src = (rel.source_entity_name || '').toLowerCase();
    const tgt = (rel.target_entity_name || '').toLowerCase();
    if (src && tgt) {
      const forwardKey = `${src}->${tgt}`;
      const reverseKey = `${tgt}->${src}`;
      if (relPairMap.has(reverseKey)) {
        reportIssue({
          ruleId: 'LINT_CIRCULAR_FK',
          ruleName: 'Circular Foreign Key Dependency',
          category: 'Integrity',
          severity: 'warning',
          entityName: `${src} & ${tgt}`,
          message: `Mutual dependency detected between '${src}' and '${tgt}'.`,
          suggestion: `Circular foreign keys can cause deadlocks during INSERT/DELETE cascades. Consider using an intermediary junction entity or a nullable deferred constraint.`,
        });
      }
      relPairMap.set(forwardKey, true);
    }
  });

  // RULE 9: Primary Key Nullable Violation
  entities.forEach((entity) => {
    (entity.attributes || []).forEach((attr) => {
      if ((attr.keyType === 'PK' || attr.keyType === 'Composite') && attr.isNullable) {
        reportIssue({
          ruleId: 'LINT_NULLABLE_PK',
          ruleName: 'Nullable Primary Key Attribute',
          category: 'Integrity',
          severity: 'error',
          entityId: entity.id,
          entityName: entity.name,
          attributeId: attr.id,
          attributeName: attr.name,
          message: `Primary key column '${attr.name}' in '${entity.name}' is marked as nullable.`,
          suggestion: `Primary keys must be NOT NULL by SQL-92 standards. Set isNullable to false.`,
          autoFixable: true,
        });
      }
    });
  });

  // Calculate Overall Schema Best Practices Score (0 - 100)
  let deductions = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  issues.forEach((issue) => {
    if (issue.severity === 'error') {
      deductions += 15;
      errorCount++;
    } else if (issue.severity === 'warning') {
      deductions += 5;
      warningCount++;
    } else {
      deductions += 1;
      infoCount++;
    }
  });

  const rawScore = 100 - deductions;
  const score = Math.max(0, Math.min(100, entities.length === 0 ? 100 : rawScore));

  let grade = 'A';
  let gradeColor = '#10b981'; // Green
  let summary = 'Excellent schema structure! Highly aligned with SQL standards.';

  if (score < 60) {
    grade = 'F';
    gradeColor = '#ef4444'; // Red
    summary = 'Critical relational anti-patterns detected. High risk of data integrity errors.';
  } else if (score < 70) {
    grade = 'D';
    gradeColor = '#f97316'; // Orange
    summary = 'Several schema issues detected. Review missing primary keys and data types.';
  } else if (score < 80) {
    grade = 'C';
    gradeColor = '#f59e0b'; // Amber
    summary = 'Acceptable schema, but optimizations needed for indexing and naming consistency.';
  } else if (score < 90) {
    grade = 'B';
    gradeColor = '#3b82f6'; // Blue
    summary = 'Good schema design. Minor performance and naming recommendations suggested.';
  }

  return {
    score,
    grade,
    gradeColor,
    summary,
    totalEntities: entities.length,
    counts: {
      total: issues.length,
      errors: errorCount,
      warnings: warningCount,
      info: infoCount,
    },
    issues,
    passedRules,
  };
}


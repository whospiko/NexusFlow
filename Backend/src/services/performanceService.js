import * as erdService from './erdService.js';

// PostgreSQL Data Type Storage Width Heuristics (Bytes per column)
const TYPE_BYTE_SIZES = {
  boolean: 1,
  bool: 1,
  smallint: 2,
  int2: 2,
  int: 4,
  integer: 4,
  int4: 4,
  serial: 4,
  bigint: 8,
  int8: 8,
  bigserial: 8,
  float: 4,
  real: 4,
  double: 8,
  'double precision': 8,
  decimal: 10,
  numeric: 10,
  date: 4,
  time: 8,
  timestamp: 8,
  timestamptz: 8,
  datetime: 8,
  uuid: 16,
  char: 1,
  string: 45, // Average string length
  varchar: 45,
  text: 220, // Average text block
  json: 300,
  jsonb: 320,
};

function getColumnByteSize(dataType) {
  const dt = (dataType || 'varchar').toLowerCase().trim();
  return TYPE_BYTE_SIZES[dt] || 40;
}

/**
 * Calculate detailed row byte width and storage projections for an entity
 */
export function calculateEntityStorageMetrics(entity, monthlyRows = 10000) {
  const PG_TUPLE_HEADER = 24; // 24 bytes fixed row overhead in Postgres
  const attributes = entity.attributes || [];

  // Null bitmap (1 byte per 8 attributes)
  const nullBitmapBytes = Math.ceil(attributes.length / 8);

  // Sum of column bytes
  let dataBytes = 0;
  attributes.forEach((attr) => {
    dataBytes += getColumnByteSize(attr.dataType);
  });

  // Alignment to 8-byte boundary
  const rawRowBytes = PG_TUPLE_HEADER + nullBitmapBytes + dataBytes;
  const alignedRowBytes = Math.ceil(rawRowBytes / 8) * 8;

  // Yearly rows
  const yearlyRows = monthlyRows * 12;
  const threeYearRows = yearlyRows * 3;
  const fiveYearRows = yearlyRows * 5;

  // Raw table data bytes
  const yearlyDataBytes = yearlyRows * alignedRowBytes;
  const threeYearDataBytes = threeYearRows * alignedRowBytes;

  // Approximate B-Tree Index overhead (~25% of table size for PK + FKs)
  const indexOverheadFactor = 1.25;

  return {
    entityId: entity.id,
    entityName: entity.name,
    columnCount: attributes.length,
    rowBytes: alignedRowBytes,
    monthlyRows,
    projections: {
      oneYear: {
        rows: yearlyRows,
        dataBytes: yearlyDataBytes,
        formattedSize: formatBytes(yearlyDataBytes),
        withIndexFormatted: formatBytes(yearlyDataBytes * indexOverheadFactor),
      },
      threeYears: {
        rows: threeYearRows,
        dataBytes: threeYearDataBytes,
        formattedSize: formatBytes(threeYearDataBytes),
        withIndexFormatted: formatBytes(threeYearDataBytes * indexOverheadFactor),
      },
      fiveYears: {
        rows: fiveYearRows,
        dataBytes: fiveYearRows * alignedRowBytes,
        formattedSize: formatBytes(fiveYearRows * alignedRowBytes),
        withIndexFormatted: formatBytes(fiveYearRows * alignedRowBytes * indexOverheadFactor),
      },
      milestones: {
        at10k: formatBytes(10000 * alignedRowBytes),
        at100k: formatBytes(100000 * alignedRowBytes),
        at1M: formatBytes(1000000 * alignedRowBytes),
        at10M: formatBytes(10000000 * alignedRowBytes),
      },
    },
  };
}

/**
 * Generate Intelligent Index Recommendations
 */
export function generateIndexRecommendations(entities, relationships) {
  const recommendations = [];

  entities.forEach((entity) => {
    (entity.attributes || []).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const isFk = attr.keyType === 'FK' || name.endsWith('_id') || name.endsWith('id');
      const isSearchFilter = /(status|type|created_at|email|code|slug|category)/i.test(name);

      if (isFk && attr.keyType !== 'PK') {
        const indexName = `idx_${entity.name.toLowerCase()}_${attr.name.toLowerCase()}`;
        recommendations.push({
          type: 'Foreign Key Index (High Selectivity)',
          priority: 'High',
          tableName: entity.name,
          columnName: attr.name,
          indexName,
          reason: `Foreign key '${attr.name}' is heavily used in JOIN conditions. Adding a B-Tree index prevents expensive sequential scans on '${entity.name}'.`,
          estimatedSpeedup: '15x - 40x on JOIN operations',
          sql: `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${entity.name}" ("${attr.name}");`,
        });
      } else if (isSearchFilter && attr.keyType === 'Normal') {
        const indexName = `idx_${entity.name.toLowerCase()}_${attr.name.toLowerCase()}`;
        recommendations.push({
          type: 'Search / Filter Candidate Index',
          priority: 'Medium',
          tableName: entity.name,
          columnName: attr.name,
          indexName,
          reason: `Column '${attr.name}' is frequently queried in WHERE filters and sorting. An index provides sub-millisecond lookup times.`,
          estimatedSpeedup: '5x - 12x on filtered queries',
          sql: `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${entity.name}" ("${attr.name}");`,
        });
      }
    });
  });

  return recommendations;
}

/**
 * Simulate Multi-Table Query Join Execution Cost & Latency
 */
export function simulateQueryCost(entities, relationships, selectedTableNames = []) {
  const tables = selectedTableNames.length > 0
    ? entities.filter((e) => selectedTableNames.map((s) => s.toLowerCase()).includes(e.name.toLowerCase()))
    : entities.slice(0, 3);

  if (tables.length === 0) {
    return {
      success: false,
      message: 'No tables selected for query simulation.',
    };
  }

  const tableNames = tables.map((t) => t.name);
  const totalColumns = tables.reduce((sum, t) => sum + (t.attributes || []).length, 0);

  // Determine Join Strategy based on table count
  let joinStrategy = 'Hash Join';
  let baseCost = 25.0;
  let estimatedLatency = '~1.5 ms';
  let hasSequentialScanRisk = false;
  const bottlenecks = [];

  if (tables.length === 1) {
    joinStrategy = 'Index Scan';
    baseCost = 8.5;
    estimatedLatency = '< 0.5 ms';
  } else if (tables.length === 2) {
    joinStrategy = 'Hash Join (In-Memory Hash Table)';
    baseCost = 42.0;
    estimatedLatency = '~2.2 ms';
  } else if (tables.length >= 3) {
    joinStrategy = 'Nested Loop + Hash Join Multi-Plan';
    baseCost = 115.0;
    estimatedLatency = '~6.8 ms';
  }

  // Check if any join pair lacks foreign key
  tables.forEach((t) => {
    const fks = (t.attributes || []).filter((a) => a.keyType === 'FK');
    if (tables.length > 1 && fks.length === 0) {
      hasSequentialScanRisk = true;
      bottlenecks.push(`Table '${t.name}' has no Foreign Key defined, risking a Cartesian Product (Cross Join).`);
      baseCost *= 3.5;
    }
  });

  if (hasSequentialScanRisk) {
    estimatedLatency = '~45.0 ms (Slow)';
  }

  return {
    success: true,
    simulatedTables: tableNames,
    joinStrategy,
    estimatedCostUnits: Math.round(baseCost * 10) / 10,
    estimatedLatency,
    hasSequentialScanRisk,
    bottlenecks,
    mockExplainPlan: [
      `-> ${joinStrategy}  (cost=0.00..${Math.round(baseCost)}.00 rows=1500 width=${totalColumns * 8})`,
      ...tables.map((t, idx) => `   -> ${idx === 0 ? 'Seq Scan on' : 'Index Scan using idx_' + t.name.toLowerCase() + '_id on'} "${t.name}"`),
    ],
  };
}

/**
 * Calculate overall project storage and performance summary
 */
export async function getProjectPerformanceEstimates(projectId, options = {}) {
  const { monthlyRowsPerTable = 15000 } = options;
  const entities = await erdService.getProjectEntities(projectId);
  const relationships = await erdService.getProjectRelationships(projectId);

  const tableEstimates = entities.map((e) => calculateEntityStorageMetrics(e, monthlyRowsPerTable));
  const indexRecommendations = generateIndexRecommendations(entities, relationships);
  const defaultSimulation = simulateQueryCost(entities, relationships);

  // Total schema storage sums
  let totalOneYearBytes = 0;
  let totalThreeYearBytes = 0;
  let totalRowWidthBytes = 0;

  tableEstimates.forEach((t) => {
    totalOneYearBytes += t.projections.oneYear.dataBytes;
    totalThreeYearBytes += t.projections.threeYears.dataBytes;
    totalRowWidthBytes += t.rowBytes;
  });

  return {
    projectId,
    totalTables: entities.length,
    averageRowBytes: entities.length > 0 ? Math.round(totalRowWidthBytes / entities.length) : 0,
    annualGrowthFormatted: formatBytes(totalOneYearBytes),
    threeYearGrowthFormatted: formatBytes(totalThreeYearBytes),
    tableEstimates,
    indexRecommendations,
    querySimulation: defaultSimulation,
  };
}

// Byte formatting helper
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}


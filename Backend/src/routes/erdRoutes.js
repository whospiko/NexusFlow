import { Router } from 'express';
import {
  getProjectEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  bulkSaveAttributes,
  saveNodePositions,
  getProjectRelationships,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getNormalizationAudit,
  getDenormalizedSchema,
  getSqlScripts,
  generateCode,
  exportHtml,
  exportPdf,
  exportDocx,
  exportMarkdown,
  importSql,
  importJson,
  exportJson,
  getTemplates,
  applyTemplate,
} from '../controllers/erdController.js';
import {
  getProjectSchemaVersions,
  commitSchemaVersion,
  getProjectSchemaVersionById,
  getProjectBranches,
  compareSchemaVersions,
  generateMigration,
  mergeSchemaBranches,
  restoreSchemaSnapshot,
} from '../controllers/schemaVersionController.js';
import * as advancedErdController from '../controllers/advancedErdController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Entities & Attributes Endpoints (Module 2)
router.get('/projects/:projectId/erd/entities', optionalAuth, getProjectEntities);
router.post('/projects/:projectId/erd/entities', optionalAuth, createEntity);
router.put('/erd/entities/:id', optionalAuth, updateEntity);
router.delete('/erd/entities/:id', optionalAuth, deleteEntity);
router.put('/erd/entities/:id/attributes', optionalAuth, bulkSaveAttributes);

// Node Positions (Module 3 Canvas)
router.post('/projects/:projectId/erd/positions', optionalAuth, saveNodePositions);

// Relationships Engine Endpoints (Module 3 & Module 4)
router.get('/projects/:projectId/erd/relationships', optionalAuth, getProjectRelationships);
router.post('/projects/:projectId/erd/relationships', optionalAuth, createRelationship);
router.put('/erd/relationships/:id', optionalAuth, updateRelationship);
router.delete('/erd/relationships/:id', optionalAuth, deleteRelationship);

// Normalization & De-normalization & SQL Generator (Module 5)
router.get('/projects/:projectId/erd/normalization', optionalAuth, getNormalizationAudit);
router.get('/projects/:projectId/erd/denormalization', optionalAuth, getDenormalizedSchema);
router.get('/projects/:projectId/erd/sql', optionalAuth, getSqlScripts);

// Code & Schema Generator (Module 6)
router.post('/projects/:projectId/erd/codegen', optionalAuth, generateCode);

// Document Exporter (Module 7: PDF / Word / Markdown / HTML)
router.post('/projects/:projectId/erd/export/html', optionalAuth, exportHtml);
router.post('/projects/:projectId/erd/export/pdf', optionalAuth, exportPdf);
router.post('/projects/:projectId/erd/export/docx', optionalAuth, exportDocx);
router.post('/projects/:projectId/erd/export/markdown', optionalAuth, exportMarkdown);

// Import & Template System (Module 9)
router.post('/projects/:projectId/erd/import/sql', optionalAuth, importSql);
router.post('/projects/:projectId/erd/import/json', optionalAuth, importJson);
router.get('/projects/:projectId/erd/export/json', optionalAuth, exportJson);
router.get('/erd/templates', optionalAuth, getTemplates);
router.post('/projects/:projectId/erd/templates/:templateId/apply', optionalAuth, applyTemplate);

// Schema Versioning, Diff, Migration & Merge Endpoints (Git for databases)
router.get('/projects/:projectId/schema/versions', optionalAuth, getProjectSchemaVersions);
router.post('/projects/:projectId/schema/versions', optionalAuth, commitSchemaVersion);
router.get('/projects/:projectId/schema/versions/:versionId', optionalAuth, getProjectSchemaVersionById);
router.get('/projects/:projectId/schema/branches', optionalAuth, getProjectBranches);
router.post('/projects/:projectId/schema/diff', optionalAuth, compareSchemaVersions);
router.post('/projects/:projectId/schema/migration', optionalAuth, generateMigration);
router.post('/projects/:projectId/schema/merge', optionalAuth, mergeSchemaBranches);
router.post('/projects/:projectId/schema/restore/:versionId', optionalAuth, restoreSchemaSnapshot);

// MODULE 8: Schema Linting & Best Practices Checker
router.get('/projects/:projectId/erd/lint', optionalAuth, advancedErdController.getSchemaLint);

// MODULE 9: Performance Estimator & Query Simulator
router.get('/projects/:projectId/erd/performance', optionalAuth, advancedErdController.getPerformanceEstimates);
router.post('/projects/:projectId/erd/performance/simulate-query', optionalAuth, advancedErdController.simulateQueryCost);

// MODULE 10: Compliance & Governance (GDPR / HIPAA / SOC2)
router.get('/projects/:projectId/erd/compliance/scan-pii', optionalAuth, advancedErdController.scanPii);
router.post('/projects/:projectId/erd/compliance/apply-pii', optionalAuth, advancedErdController.applyPiiTags);
router.get('/projects/:projectId/erd/compliance/score', optionalAuth, advancedErdController.getComplianceScore);
router.get('/projects/:projectId/erd/compliance/audit-logs', optionalAuth, advancedErdController.getAuditLogs);
router.get('/projects/:projectId/erd/compliance/review', optionalAuth, advancedErdController.getGovernanceReview);
router.post('/projects/:projectId/erd/compliance/review', optionalAuth, advancedErdController.updateGovernanceReview);
router.get('/projects/:projectId/erd/compliance/retention-script', optionalAuth, advancedErdController.generateRetentionScript);

// MODULE 11: Template Marketplace & Public Model Library
router.get('/marketplace/templates', optionalAuth, advancedErdController.getMarketplaceTemplates);
router.get('/marketplace/templates/:templateId', optionalAuth, advancedErdController.getMarketplaceTemplateById);
router.post('/projects/:projectId/marketplace/publish', optionalAuth, advancedErdController.publishTemplate);
router.post('/projects/:projectId/marketplace/clone/:templateId', optionalAuth, advancedErdController.cloneTemplateToProject);
router.post('/marketplace/templates/:templateId/clone-new', optionalAuth, advancedErdController.cloneTemplateAsNewProject);
router.post('/marketplace/templates/:templateId/rate', optionalAuth, advancedErdController.rateTemplate);

export default router;


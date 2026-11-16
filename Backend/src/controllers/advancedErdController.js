import * as lintService from '../services/lintService.js';
import * as performanceService from '../services/performanceService.js';
import * as complianceService from '../services/complianceService.js';
import * as marketplaceService from '../services/marketplaceService.js';
import * as erdService from '../services/erdService.js';

// ==========================================
// MODULE 8: SCHEMA LINTING & BEST PRACTICES
// ==========================================
export async function getSchemaLint(req, res, next) {
  try {
    const { projectId } = req.params;
    const lintResult = await lintService.lintProjectSchema(projectId);
    res.json({ success: true, data: lintResult });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// MODULE 9: PERFORMANCE ESTIMATOR
// ==========================================
export async function getPerformanceEstimates(req, res, next) {
  try {
    const { projectId } = req.params;
    const monthlyRows = req.query.monthlyRows ? parseInt(req.query.monthlyRows, 10) : 15000;
    const estimates = await performanceService.getProjectPerformanceEstimates(projectId, {
      monthlyRowsPerTable: monthlyRows,
    });
    res.json({ success: true, data: estimates });
  } catch (err) {
    next(err);
  }
}

export async function simulateQueryCost(req, res, next) {
  try {
    const { projectId } = req.params;
    const { selectedTables } = req.body;
    const entities = await erdService.getProjectEntities(projectId);
    const relationships = await erdService.getProjectRelationships(projectId);
    const simulation = performanceService.simulateQueryCost(entities, relationships, selectedTables || []);
    res.json({ success: true, data: simulation });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// MODULE 10: COMPLIANCE & GOVERNANCE
// ==========================================
export async function scanPii(req, res, next) {
  try {
    const { projectId } = req.params;
    const detected = await complianceService.scanPiiAttributes(projectId);
    res.json({ success: true, data: detected });
  } catch (err) {
    next(err);
  }
}

export async function applyPiiTags(req, res, next) {
  try {
    const { projectId } = req.params;
    const { tags } = req.body;
    const result = await complianceService.applyPiiTags(projectId, tags);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getComplianceScore(req, res, next) {
  try {
    const { projectId } = req.params;
    const score = await complianceService.calculateComplianceScore(projectId);
    res.json({ success: true, data: score });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const { projectId } = req.params;
    const logs = await complianceService.getAuditLogs(projectId);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

export async function getGovernanceReview(req, res, next) {
  try {
    const { projectId } = req.params;
    const review = await complianceService.getGovernanceReview(projectId);
    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
}

export async function updateGovernanceReview(req, res, next) {
  try {
    const { projectId } = req.params;
    const { status, notes } = req.body;
    const actor = req.user?.name || req.body.actor || 'Piko';
    const updated = await complianceService.updateGovernanceReview(projectId, {
      status,
      actor,
      notes,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function generateRetentionScript(req, res, next) {
  try {
    const { projectId } = req.params;
    const sql = await complianceService.generateDataRetentionScript(projectId);
    res.json({ success: true, data: { sql } });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// MODULE 11: TEMPLATE MARKETPLACE
// ==========================================
export async function getMarketplaceTemplates(req, res, next) {
  try {
    const { category, search } = req.query;
    const templates = await marketplaceService.getMarketplaceTemplates({ category, search });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

export async function getMarketplaceTemplateById(req, res, next) {
  try {
    const { templateId } = req.params;
    const template = await marketplaceService.getMarketplaceTemplateById(templateId);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function publishTemplate(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title, description, category, tags } = req.body;
    const author = req.user?.name || req.body.author || 'Piko';
    const published = await marketplaceService.publishProjectAsTemplate(projectId, {
      title,
      description,
      category,
      tags,
      author,
    });
    res.status(201).json({ success: true, data: published });
  } catch (err) {
    next(err);
  }
}

export async function cloneTemplateToProject(req, res, next) {
  try {
    const { projectId, templateId } = req.params;
    const actor = req.user?.name || req.body.actor || 'Piko';
    const result = await marketplaceService.cloneTemplateToProject(projectId, templateId, actor);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function cloneTemplateAsNewProject(req, res, next) {
  try {
    const { templateId } = req.params;
    const { projectName } = req.body;
    const userId = req.user?.id || 1;
    const newProject = await marketplaceService.cloneTemplateAsNewProject(userId, templateId, projectName);
    res.status(201).json({ success: true, data: newProject });
  } catch (err) {
    next(err);
  }
}

export async function rateTemplate(req, res, next) {
  try {
    const { templateId } = req.params;
    const { rating } = req.body;
    const updated = await marketplaceService.rateTemplate(templateId, rating);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}


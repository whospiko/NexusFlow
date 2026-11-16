import * as erdService from '../services/erdService.js';
import * as codeGenService from '../services/codeGenService.js';
import * as docExportService from '../services/docExportService.js';
import * as sqlParserService from '../services/sqlParserService.js';
import { broadcastErdUpdate } from '../services/socketService.js';

export async function getProjectEntities(req, res, next) {
  try {
    const { projectId } = req.params;
    const entities = await erdService.getProjectEntities(projectId);
    res.json({ success: true, data: entities });
  } catch (err) {
    next(err);
  }
}

export async function createEntity(req, res, next) {
  try {
    const { projectId } = req.params;
    const entity = await erdService.createEntity(projectId, req.body);
    broadcastErdUpdate(projectId, 'erd:entity-mutated', { action: 'create', entity });
    res.status(201).json({ success: true, data: entity });
  } catch (err) {
    next(err);
  }
}

export async function updateEntity(req, res, next) {
  try {
    const { id } = req.params;
    const entity = await erdService.updateEntity(id, req.body);
    broadcastErdUpdate(entity.project_id, 'erd:entity-mutated', { action: 'update', entity });
    res.json({ success: true, data: entity });
  } catch (err) {
    next(err);
  }
}

export async function deleteEntity(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await erdService.deleteEntity(id);
    broadcastErdUpdate(deleted.project_id, 'erd:entity-mutated', { action: 'delete', entityId: id });
    res.json({ success: true, data: deleted });
  } catch (err) {
    next(err);
  }
}

export async function bulkSaveAttributes(req, res, next) {
  try {
    const { id } = req.params;
    const { attributes } = req.body;
    if (!Array.isArray(attributes)) {
      return res.status(400).json({ success: false, message: 'Attributes must be an array' });
    }
    const updated = await erdService.bulkSaveAttributes(id, attributes);
    broadcastErdUpdate(updated.project_id, 'erd:entity-mutated', { action: 'update', entity: updated });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function saveNodePositions(req, res, next) {
  try {
    const { projectId } = req.params;
    const { positions } = req.body;
    if (!Array.isArray(positions)) {
      return res.status(400).json({ success: false, message: 'Positions must be an array' });
    }
    const result = await erdService.saveNodePositions(projectId, positions);
    broadcastErdUpdate(projectId, 'erd:node-drag-stopped', { positions });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getProjectRelationships(req, res, next) {
  try {
    const { projectId } = req.params;
    const relationships = await erdService.getProjectRelationships(projectId);
    res.json({ success: true, data: relationships });
  } catch (err) {
    next(err);
  }
}

export async function createRelationship(req, res, next) {
  try {
    const { projectId } = req.params;
    const relationship = await erdService.createRelationship(projectId, req.body);
    broadcastErdUpdate(projectId, 'erd:relationship-mutated', { action: 'create', relationship });
    res.status(201).json({ success: true, data: relationship });
  } catch (err) {
    next(err);
  }
}

export async function updateRelationship(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await erdService.updateRelationship(id, req.body);
    broadcastErdUpdate(updated.project_id, 'erd:relationship-mutated', { action: 'update', relationship: updated });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteRelationship(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await erdService.deleteRelationship(id);
    broadcastErdUpdate(deleted.project_id, 'erd:relationship-mutated', { action: 'delete', relationshipId: id });
    res.json({ success: true, data: deleted });
  } catch (err) {
    next(err);
  }
}

export async function getNormalizationAudit(req, res, next) {
  try {
    const { projectId } = req.params;
    const report = await erdService.runNormalizationAudit(projectId);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getDenormalizedSchema(req, res, next) {
  try {
    const { projectId } = req.params;
    const { tableIds } = req.query;
    const selectedIds = tableIds ? tableIds.split(',').map((id) => parseInt(id, 10)) : null;
    const schema = await erdService.computeDenormalizedSchema(projectId, selectedIds);
    res.json({ success: true, data: schema });
  } catch (err) {
    next(err);
  }
}

export async function getSqlScripts(req, res, next) {
  try {
    const { projectId } = req.params;
    const { tableIds } = req.query;
    const selectedIds = tableIds ? tableIds.split(',').map((id) => parseInt(id, 10)) : null;
    const scripts = await erdService.generateSqlScripts(projectId, selectedIds);
    res.json({ success: true, data: scripts });
  } catch (err) {
    next(err);
  }
}

// MODULE 6: Code & Schema Generator Controller
export async function generateCode(req, res, next) {
  try {
    const { projectId } = req.params;
    const { dialect = 'postgresql' } = req.body;
    const code = await codeGenService.generateProjectCode(projectId, dialect);
    res.json({ success: true, data: code });
  } catch (err) {
    next(err);
  }
}

// MODULE 7: Document Exporter Controllers (PDF / Word / Markdown / HTML)
export async function exportHtml(req, res, next) {
  try {
    const { projectId } = req.params;
    const html = await docExportService.buildHtmlDocument(projectId, req.body);
    res.json({ success: true, data: { html } });
  } catch (err) {
    next(err);
  }
}

export async function exportPdf(req, res, next) {
  try {
    const { projectId } = req.params;
    const pdfBuffer = await docExportService.generatePdfDocument(projectId, req.body);
    const buf = Buffer.from(pdfBuffer);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Content-Disposition', `attachment; filename="database-design-p${projectId}.pdf"`);
    res.end(buf);
  } catch (err) {
    next(err);
  }
}

export async function exportDocx(req, res, next) {
  try {
    const { projectId } = req.params;
    const docxBuffer = await docExportService.generateDocxDocument(projectId, req.body);
    const buf = Buffer.from(docxBuffer);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Content-Disposition', `attachment; filename="database-design-p${projectId}.docx"`);
    res.end(buf);
  } catch (err) {
    next(err);
  }
}

export async function exportMarkdown(req, res, next) {
  try {
    const { projectId } = req.params;
    const markdown = await docExportService.generateMarkdownDocument(projectId, req.body);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="database-design-p${projectId}.md"`);
    res.send(markdown);
  } catch (err) {
    next(err);
  }
}

// MODULE 9: Import & Template System Controllers
export async function importSql(req, res, next) {
  try {
    const { projectId } = req.params;
    const { sqlText, overwrite = false } = req.body;
    const result = await sqlParserService.importSqlIntoProject(projectId, sqlText, { overwrite });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function importJson(req, res, next) {
  try {
    const { projectId } = req.params;
    const { jsonData, overwrite = false } = req.body;
    const result = await sqlParserService.importJsonIntoProject(projectId, jsonData, { overwrite });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function exportJson(req, res, next) {
  try {
    const { projectId } = req.params;
    const data = await sqlParserService.exportProjectAsJson(projectId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTemplates(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        starterTemplates: sqlParserService.STARTER_TEMPLATES,
        communityModels: sqlParserService.PUBLIC_COMMUNITY_MODELS,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function applyTemplate(req, res, next) {
  try {
    const { projectId, templateId } = req.params;
    const { overwrite = false } = req.body;
    const result = await sqlParserService.applyTemplate(projectId, templateId, { overwrite });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}


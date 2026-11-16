const RAW_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem('bug_tracker_jwt');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Project & Task API
export const api = {
  // Authentication & Users
  getMe: () => request('/auth/me'),
  devLogin: (payload) => request('/auth/dev-login', { method: 'POST', body: JSON.stringify(payload) }),
  getAuthUsers: () => request('/auth/users'),

  // Project Invitations & Team Access (Multi-Tenancy)
  inviteMember: (projectId, payload) =>
    request(`/projects/${projectId}/invitations`, { method: 'POST', body: JSON.stringify(payload) }),
  getProjectMembers: (projectId) => request(`/projects/${projectId}/members`),
  getProjectPendingInvitations: (projectId) => request(`/projects/${projectId}/invitations`),
  resendInvitation: (projectId, invitationId) =>
    request(`/projects/${projectId}/invitations/${invitationId}/resend`, { method: 'POST' }),
  cancelInvitation: (projectId, invitationId) =>
    request(`/projects/${projectId}/invitations/${invitationId}`, { method: 'DELETE' }),
  getInvitationByToken: (token) => request(`/invitations/${token}`),
  acceptInvitation: (token) => request('/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) }),

  // Projects
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (project) => request('/projects', { method: 'POST', body: JSON.stringify(project) }),
  updateProject: (id, project) =>
    request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(project) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // Tasks under Project (Resource nesting)
  getTasks: (projectId, params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.priority && params.priority !== 'all') query.append('priority', params.priority);
    if (params.tag && params.tag !== 'all') query.append('tag', params.tag);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/projects/${projectId}/tasks${qs}`);
  },
  getIssues: (projectId, params = {}) => api.getTasks(projectId, params),

  createTask: (projectId, task) =>
    request(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(task) }),
  createIssue: (projectId, issue) => api.createTask(projectId, issue),

  // Tasks by ID
  getTask: (id) => request(`/tasks/${id}`),
  getIssue: (id) => api.getTask(id),

  updateTask: (id, task) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }),
  updateIssue: (id, issue) => api.updateTask(id, issue),

  updateTaskStatus: (id, status) =>
    request(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateIssueStatus: (id, status) => api.updateTaskStatus(id, status),

  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  deleteIssue: (id) => api.deleteTask(id),

  // Comments under Task
  getComments: (taskId) => request(`/tasks/${taskId}/comments`),
  createComment: (taskId, comment) =>
    request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(comment) }),
  updateComment: (id, comment) =>
    request(`/comments/${id}`, { method: 'PUT', body: JSON.stringify(comment) }),
  deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),

  // Activity Audit Log Timeline
  getActivities: (taskId) => request(`/tasks/${taskId}/activities`),

  // Tags (Many-to-Many Association)
  getTags: () => request('/tags'),
  createTag: (tag) => request('/tags', { method: 'POST', body: JSON.stringify(tag) }),
  getTaskTags: (taskId) => request(`/tasks/${taskId}/tags`),
  getIssueTags: (issueId) => api.getTaskTags(issueId),
  attachTagToTask: (taskId, tagId, actor) =>
    request(`/tasks/${taskId}/tags`, { method: 'POST', body: JSON.stringify({ tagId, actor }) }),
  attachTagToIssue: (issueId, tagId, actor) => api.attachTagToTask(issueId, tagId, actor),
  removeTagFromTask: (taskId, tagId, actor) =>
    request(`/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE', body: JSON.stringify({ actor }) }),
  removeTagFromIssue: (issueId, tagId, actor) => api.removeTagFromTask(issueId, tagId, actor),

  // Teams Management (Per-User Scoped Project Teams)
  getTeams: () => request('/teams'),
  removeProjectTeamMember: (projectId, userId) =>
    request(`/teams/${projectId}/members/${userId}`, { method: 'DELETE' }),

  // Advanced / Cross-Project Filters
  getFilteredTasks: (params = {}) => {
    const query = new URLSearchParams();
    if (params.preset) query.append('preset', params.preset);
    if (params.projectId && params.projectId !== 'all') query.append('projectId', params.projectId);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.priority && params.priority !== 'all') query.append('priority', params.priority);
    if (params.assignee && params.assignee !== 'all') query.append('assignee', params.assignee);
    if (params.tag && params.tag !== 'all') query.append('tag', params.tag);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/filters/tasks${qs}`);
  },
  getFilteredIssues: (params = {}) => api.getFilteredTasks(params),

  // Project Time Tracking, Gantt & Workload
  getProjectGantt: (projectId) => request(`/projects/${projectId}/gantt`),
  getProjectTimesheets: (projectId, params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/projects/${projectId}/timesheets${qs}`);
  },
  getProjectWorkload: (projectId) => request(`/projects/${projectId}/workload`),

  // Task Work / Time Logging
  getTimeLogs: (taskId) => request(`/tasks/${taskId}/time-logs`),
  createTimeLog: (taskId, logData) =>
    request(`/tasks/${taskId}/time-logs`, { method: 'POST', body: JSON.stringify(logData) }),
  deleteTimeLog: (logId) => request(`/time-logs/${logId}`, { method: 'DELETE' }),

  // ITPM Task Dependencies (FS, SS, FF, SF)
  getProjectDependencies: (projectId) => request(`/projects/${projectId}/dependencies`),
  createDependency: (projectId, payload) =>
    request(`/projects/${projectId}/dependencies`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteDependency: (id, actor) =>
    request(`/dependencies/${id}`, { method: 'DELETE', body: JSON.stringify({ actor }) }),
  getTaskDependencies: (taskId) => request(`/tasks/${taskId}/dependencies`),
  getIssueDependencies: (issueId) => api.getTaskDependencies(issueId),

  // ITPM & SE Requirements Engineering & Traceability Matrix (RETM)
  getProjectRequirements: (projectId, params = {}) => {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'all') query.append('type', params.type);
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/projects/${projectId}/requirements${qs}`);
  },
  createRequirement: (projectId, payload) =>
    request(`/projects/${projectId}/requirements`, { method: 'POST', body: JSON.stringify(payload) }),
  updateRequirement: (id, payload) =>
    request(`/requirements/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRequirement: (id) =>
    request(`/requirements/${id}`, { method: 'DELETE' }),
  linkTaskToRequirement: (id, taskId) =>
    request(`/requirements/${id}/tasks`, { method: 'POST', body: JSON.stringify({ taskId }) }),
  unlinkTaskFromRequirement: (id, taskId) =>
    request(`/requirements/${id}/tasks/${taskId}`, { method: 'DELETE' }),

  // Project Duplication & Version History (Snapshots)
  duplicateProject: (projectId, payload) =>
    request(`/projects/${projectId}/duplicate`, { method: 'POST', body: JSON.stringify(payload) }),
  getProjectVersions: (projectId) =>
    request(`/projects/${projectId}/versions`),
  createProjectVersion: (projectId, payload) =>
    request(`/projects/${projectId}/versions`, { method: 'POST', body: JSON.stringify(payload) }),
  getProjectVersion: (projectId, versionId) =>
    request(`/projects/${projectId}/versions/${versionId}`),
  restoreProjectVersion: (projectId, versionId, payload = {}) =>
    request(`/projects/${projectId}/versions/${versionId}/restore`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteProjectVersion: (projectId, versionId) =>
    request(`/projects/${projectId}/versions/${versionId}`, { method: 'DELETE' }),

  // ERD & Data Modeling Engine (Raw SQL Backend)
  getErdEntities: (projectId) => request(`/projects/${projectId}/erd/entities`),
  createErdEntity: (projectId, payload) =>
    request(`/projects/${projectId}/erd/entities`, { method: 'POST', body: JSON.stringify(payload) }),
  updateErdEntity: (id, payload) =>
    request(`/erd/entities/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteErdEntity: (id) =>
    request(`/erd/entities/${id}`, { method: 'DELETE' }),
  bulkSaveErdAttributes: (id, attributes) =>
    request(`/erd/entities/${id}/attributes`, { method: 'PUT', body: JSON.stringify({ attributes }) }),
  saveErdNodePositions: (projectId, positions) =>
    request(`/projects/${projectId}/erd/positions`, { method: 'POST', body: JSON.stringify({ positions }) }),

  getErdRelationships: (projectId) => request(`/projects/${projectId}/erd/relationships`),
  createErdRelationship: (projectId, payload) =>
    request(`/projects/${projectId}/erd/relationships`, { method: 'POST', body: JSON.stringify(payload) }),
  updateErdRelationship: (id, payload) =>
    request(`/erd/relationships/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteErdRelationship: (id) =>
    request(`/erd/relationships/${id}`, { method: 'DELETE' }),

  getErdNormalizationAudit: (projectId) => request(`/projects/${projectId}/erd/normalization`),
  getErdDenormalizedSchema: (projectId, tableIds) => {
    const qs = tableIds ? `?tableIds=${tableIds.join(',')}` : '';
    return request(`/projects/${projectId}/erd/denormalization${qs}`);
  },
  getErdSqlScripts: (projectId, tableIds) => {
    const qs = tableIds ? `?tableIds=${tableIds.join(',')}` : '';
    return request(`/projects/${projectId}/erd/sql${qs}`);
  },

  // Module 6: Code & Schema Generator
  generateErdCode: (projectId, dialect = 'postgresql') =>
    request(`/projects/${projectId}/erd/codegen`, { method: 'POST', body: JSON.stringify({ dialect }) }),

  // Module 7: Document Exporter (PDF / Word / Markdown / HTML)
  exportErdHtml: (projectId, payload) =>
    request(`/projects/${projectId}/erd/export/html`, { method: 'POST', body: JSON.stringify(payload) }),

  exportErdPdf: async (projectId, payload, filename = `database-design-p${projectId}.pdf`) => {
    const token = localStorage.getItem('bug_tracker_jwt');
    const res = await fetch(`/api/projects/${projectId}/erd/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = 'PDF export failed';
      try {
        const json = JSON.parse(text);
        msg = json.message || msg;
      } catch {
        if (text) msg = text;
      }
      throw new Error(msg);
    }
    const rawBlob = await res.blob();
    const blob = new Blob([rawBlob], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },

  exportErdDocx: async (projectId, payload, filename = `database-design-p${projectId}.docx`) => {
    const token = localStorage.getItem('bug_tracker_jwt');
    const res = await fetch(`/api/projects/${projectId}/erd/export/docx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = 'DOCX export failed';
      try {
        const json = JSON.parse(text);
        msg = json.message || msg;
      } catch {
        if (text) msg = text;
      }
      throw new Error(msg);
    }
    const rawBlob = await res.blob();
    const blob = new Blob([rawBlob], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },

  exportErdMarkdown: async (projectId, payload, filename = `database-design-p${projectId}.md`) => {
    const token = localStorage.getItem('bug_tracker_jwt');
    const res = await fetch(`/api/projects/${projectId}/erd/export/markdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Markdown export failed');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },

  // Module 9: Import & Template System
  importErdSql: (projectId, sqlText, overwrite = false) =>
    request(`/projects/${projectId}/erd/import/sql`, {
      method: 'POST',
      body: JSON.stringify({ sqlText, overwrite }),
    }),

  importErdJson: (projectId, jsonData, overwrite = false) =>
    request(`/projects/${projectId}/erd/import/json`, {
      method: 'POST',
      body: JSON.stringify({ jsonData, overwrite }),
    }),

  exportErdJson: (projectId) => request(`/projects/${projectId}/erd/export/json`),

  getErdTemplates: () => request('/erd/templates'),

  applyErdTemplate: (projectId, templateId, overwrite = false) =>
    request(`/projects/${projectId}/erd/templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ overwrite }),
    }),

  // Module 10: Schema Versioning & Diff/Merge (Git for databases)
  getSchemaVersions: (projectId, branch = null) => {
    const qs = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    return request(`/projects/${projectId}/schema/versions${qs}`);
  },

  commitSchemaVersion: (projectId, payload) =>
    request(`/projects/${projectId}/schema/versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSchemaVersionById: (projectId, versionId) =>
    request(`/projects/${projectId}/schema/versions/${versionId}`),

  getSchemaBranches: (projectId) =>
    request(`/projects/${projectId}/schema/branches`),

  compareSchemaVersions: (projectId, payload) =>
    request(`/projects/${projectId}/schema/diff`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateSchemaMigration: (projectId, payload) =>
    request(`/projects/${projectId}/schema/migration`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  mergeSchemaBranches: (projectId, payload) =>
    request(`/projects/${projectId}/schema/merge`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  restoreSchemaVersion: (projectId, versionId) =>
    request(`/projects/${projectId}/schema/restore/${versionId}`, {
      method: 'POST',
    }),

  // Module 8: Schema Linting & Best Practices Checker
  getSchemaLint: (projectId) => request(`/projects/${projectId}/erd/lint`),

  // Module 9: Performance Estimator & Query Simulator
  getPerformanceEstimates: (projectId, monthlyRows = 15000) =>
    request(`/projects/${projectId}/erd/performance?monthlyRows=${monthlyRows}`),
  simulateQueryCost: (projectId, selectedTables = []) =>
    request(`/projects/${projectId}/erd/performance/simulate-query`, {
      method: 'POST',
      body: JSON.stringify({ selectedTables }),
    }),

  // Module 10: Compliance & Governance (GDPR / HIPAA / SOC2)
  scanPii: (projectId) => request(`/projects/${projectId}/erd/compliance/scan-pii`),
  applyPiiTags: (projectId, tags) =>
    request(`/projects/${projectId}/erd/compliance/apply-pii`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    }),
  getComplianceScore: (projectId) => request(`/projects/${projectId}/erd/compliance/score`),
  getAuditLogs: (projectId) => request(`/projects/${projectId}/erd/compliance/audit-logs`),
  getGovernanceReview: (projectId) => request(`/projects/${projectId}/erd/compliance/review`),
  updateGovernanceReview: (projectId, payload) =>
    request(`/projects/${projectId}/erd/compliance/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getRetentionScript: (projectId) => request(`/projects/${projectId}/erd/compliance/retention-script`),

  // Module 11: Template Marketplace & Public Model Library
  getMarketplaceTemplates: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.category && params.category !== 'All') qs.append('category', params.category);
    if (params.search) qs.append('search', params.search);
    const qStr = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/marketplace/templates${qStr}`);
  },
  getMarketplaceTemplateById: (templateId) => request(`/marketplace/templates/${templateId}`),
  publishMarketplaceTemplate: (projectId, payload) =>
    request(`/projects/${projectId}/marketplace/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cloneMarketplaceTemplate: (projectId, templateId) =>
    request(`/projects/${projectId}/marketplace/clone/${templateId}`, {
      method: 'POST',
    }),
  cloneTemplateAsNewProject: (templateId, projectName) =>
    request(`/marketplace/templates/${templateId}/clone-new`, {
      method: 'POST',
      body: JSON.stringify({ projectName }),
    }),
  rateMarketplaceTemplate: (templateId, rating) =>
    request(`/marketplace/templates/${templateId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),
};

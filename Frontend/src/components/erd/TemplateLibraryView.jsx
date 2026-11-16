import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import {
  BookOpen,
  Download,
  Upload,
  FileCode,
  FileText,
  Copy,
  Check,
  Sparkles,
  Layers,
  Database,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Table as TableIcon,
  GitMerge,
  Globe,
  Sliders,
} from 'lucide-react';

const SAMPLE_SQL_DDL = `-- Sample SQL DDL: Customer & Order Management
CREATE TABLE customers (
  id INT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_items (
  order_id INT NOT NULL,
  item_seq INT NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, item_seq),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);`;

export function TemplateLibraryView({ projectId, onRefreshProject }) {
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'sql' | 'json'
  const [catalog, setCatalog] = useState({ starterTemplates: [], communityModels: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // SQL Import State
  const [sqlInput, setSqlInput] = useState('');
  const [overwriteSql, setOverwriteSql] = useState(false);

  // JSON Import / Export State
  const [jsonInput, setJsonInput] = useState('');
  const [overwriteJson, setOverwriteJson] = useState(false);

  // Fetch Templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.getErdTemplates();
      setCatalog(res.data || { starterTemplates: [], communityModels: [] });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load templates catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Apply Template / Community Model
  const handleApplyTemplate = async (templateId, title) => {
    const overwrite = window.confirm(
      `Apply "${title}" to this project?\n\nClick OK to replace existing project entities with this template model, or Cancel to abort.`
    );
    if (!overwrite) return;

    try {
      setActionLoading(true);
      setErrorMsg('');
      setStatusMsg(`Applying "${title}" model to project...`);

      const res = await api.applyErdTemplate(projectId, templateId, true);
      setStatusMsg(`Template applied! ${res.data?.importedEntities} entities created.`);
      setTimeout(() => setStatusMsg(''), 4000);
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to apply template');
    } finally {
      setActionLoading(false);
    }
  };

  // Import SQL
  const handleImportSql = async (e) => {
    e.preventDefault();
    if (!sqlInput.trim()) {
      setErrorMsg('Please paste SQL DDL script');
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg('');
      setStatusMsg('Parsing SQL AST and auto-generating relational entities...');

      const res = await api.importErdSql(projectId, sqlInput, overwriteSql);
      setStatusMsg(
        `SQL successfully imported! Created ${res.data?.importedEntities} entities and ${res.data?.importedRelationships} relationships.`
      );
      setSqlInput('');
      setTimeout(() => setStatusMsg(''), 4000);
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to parse and import SQL');
    } finally {
      setActionLoading(false);
    }
  };

  // Import JSON
  const handleImportJson = async (e) => {
    e.preventDefault();
    if (!jsonInput.trim()) {
      setErrorMsg('Please paste JSON model data');
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg('');
      setStatusMsg('Restoring ERD model from JSON...');

      const res = await api.importErdJson(projectId, jsonInput, overwriteJson);
      setStatusMsg(`Model restored! ${res.data?.importedEntities} entities loaded.`);
      setJsonInput('');
      setTimeout(() => setStatusMsg(''), 4000);
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to import JSON model');
    } finally {
      setActionLoading(false);
    }
  };

  // Export JSON Backup
  const handleExportJson = async () => {
    try {
      setActionLoading(true);
      const res = await api.exportErdJson(projectId);
      const jsonStr = JSON.stringify(res.data, null, 2);

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `erd-model-backup-p${projectId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to export model JSON');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] min-h-[640px] bg-[#10141e] border border-[#22273b] rounded-lg overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#22273b] bg-[#161b26] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30">
            <BookOpen size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#dfe1e6] flex items-center gap-2">
              Module 9: Import & Template System
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                SQL AST & Catalog
              </span>
            </h2>
            <p className="text-xs text-[#8c9bab]">
              Import DDL scripts via AST parsing, restore JSON backups, apply starter domain templates, or clone community models.
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#141923] p-1 rounded-lg border border-[#2e374f]">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-[#0c66e4] text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              <Sparkles size={13} />
              <span>Starter & Public Models</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'sql'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              <FileCode size={13} />
              <span>Import from SQL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'json'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              <Upload size={13} />
              <span>JSON Backup / Restore</span>
            </button>
          </div>

          <a
            href="/explore"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all cursor-pointer shadow-sm"
          >
            <Globe size={13} />
            <span>Marketplace Hub ↗</span>
          </a>
        </div>
      </div>

      {statusMsg && (
        <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: STARTER TEMPLATES & PUBLIC COMMUNITY MODELS */}
      {activeTab === 'templates' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section A: Starter Domain Templates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                <span>Pre-built Starter Domain Templates</span>
              </h3>
              <span className="text-[11px] text-[#8c9bab]">
                Fully normalized models with PKs, FKs, and weak entities
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {catalog.starterTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-[#141923] border border-[#242b3d] hover:border-[#38435d] rounded-xl p-4 flex flex-col justify-between transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl p-2 rounded-lg bg-[#1c2230] border border-[#2e374f]">
                        {tpl.icon}
                      </span>
                      <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {tpl.category}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#dfe1e6] group-hover:text-[#579dff] transition-colors mb-1">
                      {tpl.title}
                    </h4>
                    <p className="text-xs text-[#8c9bab] line-clamp-3 mb-4">
                      {tpl.description}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-[#626f86] font-mono border-t border-[#22273b] pt-2 mb-3">
                      <span className="flex items-center gap-1">
                        <TableIcon size={12} />
                        {tpl.entityCount} Entities
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <GitMerge size={12} />
                        {tpl.relationshipCount} Relations
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApplyTemplate(tpl.id, tpl.title)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <span>Apply Starter Model</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section B: Clone from Public Community Models */}
          <div className="pt-2 border-t border-[#22273b]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2">
                <Globe size={14} className="text-teal-400" />
                <span>Clone from Curated Public Community Models</span>
              </h3>
              <span className="text-[11px] text-[#8c9bab]">
                Crowdsourced reference models from enterprise domains
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catalog.communityModels.map((pub) => (
                <div
                  key={pub.id}
                  className="bg-[#141923] border border-[#242b3d] hover:border-teal-500/40 rounded-xl p-4 flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl p-1.5 rounded-lg bg-[#1c2230] border border-[#2e374f]">
                          {pub.icon}
                        </span>
                        <div>
                          <h4 className="font-bold text-xs text-[#dfe1e6]">
                            {pub.title}
                          </h4>
                          <span className="text-[10px] text-[#8c9bab]">
                            By {pub.author}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                        {pub.badge}
                      </span>
                    </div>

                    <p className="text-xs text-[#8c9bab] line-clamp-2 my-2">
                      {pub.description}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#626f86] mb-3">
                      <span>{pub.entityCount} Normalized Entities</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApplyTemplate(pub.id, pub.title)}
                    className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <span>Clone Model to Project</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT FROM SQL DDL (AST PARSER) */}
      {activeTab === 'sql' && (
        <form onSubmit={handleImportSql} className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2">
                <FileCode size={15} className="text-purple-400" />
                <span>Import from SQL DDL Script (node-sql-parser AST)</span>
              </h3>
              <p className="text-xs text-[#8c9bab]">
                Paste any standard <code>CREATE TABLE</code> DDL script. The AST engine detects columns, primary keys, and foreign keys.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSqlInput(SAMPLE_SQL_DDL)}
              className="px-2.5 py-1 rounded bg-[#1c2230] hover:bg-[#252d40] border border-[#2e374f] text-xs font-semibold text-sky-400 cursor-pointer"
            >
              Load Sample DDL
            </button>
          </div>

          <div className="flex-1 relative border border-[#2e374f] rounded-xl overflow-hidden bg-[#0d1117]">
            <textarea
              required
              rows={12}
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              placeholder="CREATE TABLE customers (&#10;  id INT PRIMARY KEY,&#10;  name VARCHAR(100) NOT NULL,&#10;  email VARCHAR(100) UNIQUE&#10;);&#10;&#10;CREATE TABLE orders (&#10;  id INT PRIMARY KEY,&#10;  customer_id INT REFERENCES customers(id),&#10;  total_amount DECIMAL(10,2)&#10;);"
              className="w-full h-full p-4 bg-transparent text-[#e6edf3] font-mono text-xs focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#22273b]">
            <label className="flex items-center gap-2 text-xs text-[#dfe1e6] cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteSql}
                onChange={(e) => setOverwriteSql(e.target.checked)}
                className="w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
              />
              <span>Overwrite existing project entities (delete previous tables)</span>
            </label>

            <button
              type="submit"
              disabled={actionLoading || !sqlInput.trim()}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              <span>{actionLoading ? 'Parsing AST...' : 'Parse & Generate Entities'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: JSON BACKUP & RESTORE */}
      {activeTab === 'json' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Export JSON Card */}
          <div className="bg-[#141923] border border-[#22273b] rounded-xl p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2">
                <Download size={15} className="text-teal-400" />
                <span>Export Project Model as JSON Backup</span>
              </h3>
              <p className="text-xs text-[#8c9bab] mt-0.5">
                Download a complete portable JSON archive of all entities, coordinates, attributes, and relationships.
              </p>
            </div>

            <button
              type="button"
              disabled={actionLoading}
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            >
              <Download size={14} />
              <span>Download JSON Backup</span>
            </button>
          </div>

          {/* Import JSON Form */}
          <form onSubmit={handleImportJson} className="bg-[#141923] border border-[#22273b] rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2">
                <Upload size={15} className="text-sky-400" />
                <span>Restore Model from JSON Archive</span>
              </h3>
              <p className="text-xs text-[#8c9bab] mt-0.5">
                Paste JSON data from a previously exported model to restore all entity definitions and canvas positions.
              </p>
            </div>

            <textarea
              rows={8}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{ "version": "1.0", "entities": [...], "relationships": [...] }'
              className="w-full p-3 rounded-lg bg-[#10141e] border border-[#2e374f] text-[#dfe1e6] font-mono text-xs focus:outline-none focus:border-[#579dff]"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#22273b]">
              <label className="flex items-center gap-2 text-xs text-[#dfe1e6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteJson}
                  onChange={(e) => setOverwriteJson(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0c66e4] focus:ring-0"
                />
                <span>Overwrite existing project entities</span>
              </label>

              <button
                type="submit"
                disabled={actionLoading || !jsonInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-40"
              >
                {actionLoading ? 'Restoring...' : 'Restore Model'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


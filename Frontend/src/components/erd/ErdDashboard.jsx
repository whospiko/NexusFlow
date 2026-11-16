import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import { EntityManagerView } from './EntityManagerView.jsx';
import { VisualCanvasView } from './VisualCanvasView.jsx';
import { RelationshipLogicView } from './RelationshipLogicView.jsx';
import { NormalizationEngineView } from './NormalizationEngineView.jsx';
import { CodeGeneratorView } from './CodeGeneratorView.jsx';
import { DocumentExporterView } from './DocumentExporterView.jsx';
import { TemplateLibraryView } from './TemplateLibraryView.jsx';
import { SchemaVersioningView } from './SchemaVersioningView.jsx';
import { SchemaLintView } from './SchemaLintView.jsx';
import { PerformanceEstimatorView } from './PerformanceEstimatorView.jsx';
import { ComplianceGovernanceView } from './ComplianceGovernanceView.jsx';
import {
  Database,
  Layers,
  GitBranch,
  GitMerge,
  Sparkles,
  RefreshCw,
  Cpu,
  Table as TableIcon,
  CheckCircle2,
  AlertTriangle,
  Code,
  FileText,
  BookOpen,
  Zap,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';

export function ErdDashboard({ projectId }) {
  // Subtab navigation:
  // 'entities' | 'canvas' | 'relationships' | 'normalization' | 'codegen' | 'export' | 'versioning' | 'lint' | 'performance' | 'compliance' | 'templates'
  const [activeModule, setActiveModule] = useState('entities');
  const [entities, setEntities] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load project entities and relationships
  const refreshErdData = useCallback(async () => {
    try {
      setLoading(true);
      const [entitiesRes, relsRes] = await Promise.all([
        api.getErdEntities(projectId),
        api.getErdRelationships(projectId),
      ]);
      setEntities(entitiesRes.data || []);
      setRelationships(relsRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load ERD modeling data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refreshErdData();
  }, [refreshErdData]);

  return (
    <div className="space-y-4">
      {/* Top Module Navigation Bar */}
      <div className="flex items-center justify-between bg-[#161b26] p-2 rounded-xl border border-[#22273b] gap-2 overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap scroll-smooth flex-1 min-w-0">
          {/* Module 2: Entities & Attributes */}
          <button
            type="button"
            onClick={() => setActiveModule('entities')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'entities'
                ? 'bg-[#0c66e4] text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <Database size={14} />
            <span>Entities</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30">
              {entities.length}
            </span>
          </button>

          {/* Module 3: Visual Canvas */}
          <button
            type="button"
            onClick={() => setActiveModule('canvas')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'canvas'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <Layers size={14} />
            <span>Canvas (ERD)</span>
          </button>

          {/* Module 4: Relationships */}
          <button
            type="button"
            onClick={() => setActiveModule('relationships')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'relationships'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <GitMerge size={14} />
            <span>Relations</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30">
              {relationships.length}
            </span>
          </button>

          {/* Module 5: Normalization */}
          <button
            type="button"
            onClick={() => setActiveModule('normalization')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'normalization'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <Sparkles size={14} />
            <span>Normalize</span>
          </button>

          {/* Module 6: Code Generator */}
          <button
            type="button"
            onClick={() => setActiveModule('codegen')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'codegen'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <Code size={14} />
            <span>Code Gen</span>
          </button>

          {/* Module 7: Export Document */}
          <button
            type="button"
            onClick={() => setActiveModule('export')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'export'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <FileText size={14} />
            <span>Export</span>
          </button>

          {/* Module 8: Schema Linting (Feature 8) */}
          <button
            type="button"
            onClick={() => setActiveModule('lint')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'lint'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <CheckCheck size={14} className="text-blue-400" />
            <span>Schema Linting</span>
          </button>

          {/* Module 9: Performance Estimator (Feature 9) */}
          <button
            type="button"
            onClick={() => setActiveModule('performance')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'performance'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <Zap size={14} className="text-indigo-400" />
            <span>Performance</span>
          </button>

          {/* Module 10: Compliance & Governance (Feature 10) */}
          <button
            type="button"
            onClick={() => setActiveModule('compliance')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'compliance'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Compliance & GDPR</span>
          </button>

          {/* Module 11: Versioning & Git Engine (Feature 5) */}
          <button
            type="button"
            onClick={() => setActiveModule('versioning')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'versioning'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <GitBranch size={14} />
            <span>Versioning & Diff ⭐</span>
          </button>

          {/* Module 12: Templates & Marketplace (Feature 11) */}
          <button
            type="button"
            onClick={() => setActiveModule('templates')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeModule === 'templates'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
            }`}
          >
            <BookOpen size={14} />
            <span>Templates & Import</span>
          </button>
        </div>

        {/* Global Refresh & Engine Tech Pill */}
        <div className="flex items-center gap-2 pr-1 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8c9bab] bg-[#10141e] px-2.5 py-1 rounded-md border border-[#242b3d]">
            <Cpu size={12} className="text-emerald-400" />
            <span>Raw SQL pg Pool</span>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={refreshErdData}
            className="p-1.5 rounded-lg bg-[#1a202e] border border-[#2e374f] text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#252d40] transition-colors cursor-pointer"
            title="Refresh All ERD Modules"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Render Selected Module */}
      {activeModule === 'entities' && (
        <EntityManagerView
          projectId={projectId}
          entities={entities}
          onRefresh={refreshErdData}
        />
      )}

      {activeModule === 'canvas' && (
        <VisualCanvasView
          projectId={projectId}
          entities={entities}
          relationships={relationships}
          onRefresh={refreshErdData}
        />
      )}

      {activeModule === 'relationships' && (
        <RelationshipLogicView
          projectId={projectId}
          entities={entities}
          relationships={relationships}
          onRefresh={refreshErdData}
        />
      )}

      {activeModule === 'normalization' && (
        <NormalizationEngineView
          projectId={projectId}
          entities={entities}
          relationships={relationships}
        />
      )}

      {activeModule === 'codegen' && (
        <CodeGeneratorView projectId={projectId} />
      )}

      {activeModule === 'export' && (
        <DocumentExporterView projectId={projectId} />
      )}

      {activeModule === 'lint' && (
        <SchemaLintView
          projectId={projectId}
          onRefreshProject={refreshErdData}
        />
      )}

      {activeModule === 'performance' && (
        <PerformanceEstimatorView
          projectId={projectId}
        />
      )}

      {activeModule === 'compliance' && (
        <ComplianceGovernanceView
          projectId={projectId}
        />
      )}

      {activeModule === 'versioning' && (
        <SchemaVersioningView
          projectId={projectId}
          onRefreshProject={refreshErdData}
          onNavigateModule={(mod) => setActiveModule(mod)}
        />
      )}

      {activeModule === 'templates' && (
        <TemplateLibraryView
          projectId={projectId}
          onRefreshProject={refreshErdData}
        />
      )}
    </div>
  );
}

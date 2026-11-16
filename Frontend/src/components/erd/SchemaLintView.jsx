import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  Award,
  Sparkles,
  FileCheck,
  Filter,
  ArrowRight,
  Database,
  ExternalLink,
  Sliders,
} from 'lucide-react';

export function SchemaLintView({ projectId }) {
  const [lintData, setLintData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSeverity, setActiveSeverity] = useState('all'); // 'all' | 'error' | 'warning' | 'info'
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'Integrity' | 'Naming' | 'Standards' | 'Performance'

  const runLint = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getSchemaLint(projectId);
      setLintData(res.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to execute schema linting audit.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    runLint();
  }, [runLint]);

  const issues = lintData?.issues || [];
  const filteredIssues = issues.filter((item) => {
    if (activeSeverity !== 'all' && item.severity !== activeSeverity) return false;
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Quality Score Header Banner */}
      <div className="bg-[#141923] border border-[#242c40] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            {/* Circular / Large Score Badge */}
            <div
              className="w-18 h-18 rounded-2xl flex flex-col items-center justify-center border shadow-xl shrink-0"
              style={{
                backgroundColor: `${lintData?.gradeColor || '#10b981'}15`,
                borderColor: `${lintData?.gradeColor || '#10b981'}40`,
                color: lintData?.gradeColor || '#10b981',
              }}
            >
              <span className="text-2xl font-black tracking-tight">{lintData?.score ?? '--'}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">/ 100</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Schema Linting & Best Practices</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-black uppercase font-mono"
                    style={{
                      backgroundColor: `${lintData?.gradeColor || '#10b981'}25`,
                      color: lintData?.gradeColor || '#10b981',
                      border: `1px solid ${lintData?.gradeColor || '#10b981'}50`,
                    }}
                  >
                    Grade {lintData?.grade || 'A'}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-[#8c9bab] max-w-xl">
                {lintData?.summary || 'Auditing relational integrity, naming standards, anti-patterns & SQL-92 standards.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              disabled={loading}
              onClick={runLint}
              className="px-3.5 py-1.5 bg-[#1b2232] hover:bg-[#252f44] border border-[#2e374f] text-[#dfe1e6] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-sky-400' : 'text-sky-400'} />
              <span>Re-run Lint Audit</span>
            </button>
          </div>
        </div>

        {/* Breakdown Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#1e2538] text-xs">
          <div
            onClick={() => setActiveSeverity(activeSeverity === 'error' ? 'all' : 'error')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              activeSeverity === 'error'
                ? 'bg-rose-500/15 border-rose-500/50 text-white'
                : 'bg-[#181f2e] border-[#252f44] text-[#8c9bab] hover:border-[#374564]'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
              <ShieldAlert size={12} />
              <span>Critical Errors</span>
            </div>
            <div className="text-lg font-black text-rose-300 mt-0.5 font-mono">
              {lintData?.counts?.errors ?? 0}
            </div>
          </div>

          <div
            onClick={() => setActiveSeverity(activeSeverity === 'warning' ? 'all' : 'warning')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              activeSeverity === 'warning'
                ? 'bg-amber-500/15 border-amber-500/50 text-white'
                : 'bg-[#181f2e] border-[#252f44] text-[#8c9bab] hover:border-[#374564]'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>Anti-Patterns</span>
            </div>
            <div className="text-lg font-black text-amber-300 mt-0.5 font-mono">
              {lintData?.counts?.warnings ?? 0}
            </div>
          </div>

          <div
            onClick={() => setActiveSeverity(activeSeverity === 'info' ? 'all' : 'info')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              activeSeverity === 'info'
                ? 'bg-sky-500/15 border-sky-500/50 text-white'
                : 'bg-[#181f2e] border-[#252f44] text-[#8c9bab] hover:border-[#374564]'
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-sky-400 flex items-center gap-1">
              <Info size={12} />
              <span>Naming & Style</span>
            </div>
            <div className="text-lg font-black text-sky-300 mt-0.5 font-mono">
              {lintData?.counts?.info ?? 0}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#181f2e] border border-[#252f44] text-[#8c9bab]">
            <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>Passed Standards</span>
            </div>
            <div className="text-lg font-black text-emerald-300 mt-0.5 font-mono">
              {lintData?.passedRules?.length ?? 0}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Category Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full flex-nowrap py-1 text-xs">
        <span className="text-[#8c9bab] text-[11px] font-bold mr-1 flex items-center gap-1 shrink-0">
          <Filter size={12} /> Filter:
        </span>
        {['all', 'Integrity', 'Naming', 'Standards', 'Performance'].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-[#0c66e4] text-white shadow-sm'
                : 'bg-[#141923] border border-[#22273b] text-[#8c9bab] hover:text-[#dfe1e6]'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {loading && (
          <div className="py-12 text-center text-[#8c9bab] text-xs">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-sky-400" />
            <span>Analyzing relational schema rules...</span>
          </div>
        )}

        {!loading && filteredIssues.length === 0 && (
          <div className="py-12 text-center bg-[#141923] border border-[#242c40] rounded-xl space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-sm font-bold text-white">Zero Issues Found!</h3>
            <p className="text-xs text-[#8c9bab] max-w-md mx-auto">
              Your schema complies with all naming conventions, relational integrity rules, and ISO/SQL standards.
            </p>
          </div>
        )}

        {!loading &&
          filteredIssues.map((issue) => {
            const isError = issue.severity === 'error';
            const isWarning = issue.severity === 'warning';

            return (
              <div
                key={issue.id}
                className={`p-4 rounded-xl border transition-all shadow-md space-y-2.5 ${
                  isError
                    ? 'bg-rose-950/15 border-rose-500/30'
                    : isWarning
                    ? 'bg-amber-950/15 border-amber-500/30'
                    : 'bg-[#141923] border-[#242c40]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[9px] uppercase font-bold font-mono px-2 py-0.5 rounded ${
                        isError
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : isWarning
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      }`}
                    >
                      {issue.severity}
                    </span>

                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-[#8c9bab]">
                      {issue.category}
                    </span>

                    <span className="text-xs font-bold text-white">{issue.ruleName}</span>
                  </div>

                  <div className="text-xs font-mono text-[#8c9bab]">
                    {issue.entityName && (
                      <span className="text-sky-300 font-semibold">{issue.entityName}</span>
                    )}
                    {issue.attributeName && (
                      <span className="text-purple-300 font-normal">.{issue.attributeName}</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#dfe1e6]">{issue.message}</p>

                {/* Suggestion Box */}
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-xs text-[#c2cddc] flex items-start gap-2">
                  <Sparkles size={13} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                      Recommendation & Best Practice Fix
                    </div>
                    <p className="italic text-[11px] leading-relaxed">{issue.suggestion}</p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}


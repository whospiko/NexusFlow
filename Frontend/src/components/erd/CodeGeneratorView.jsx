import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api.js';
import {
  Code,
  Copy,
  Download,
  Check,
  RefreshCw,
  GitCompare,
  FileCode,
  Layers,
  Database,
  Terminal,
  Sliders,
  ChevronDown,
} from 'lucide-react';

const DIALECTS = [
  { id: 'postgresql', label: 'PostgreSQL', ext: 'sql', icon: '🐘' },
  { id: 'mysql', label: 'MySQL', ext: 'sql', icon: '🐬' },
  { id: 'sqlserver', label: 'SQL Server (T-SQL)', ext: 'sql', icon: '🪟' },
  { id: 'oracle', label: 'Oracle (PL/SQL)', ext: 'sql', icon: '🔴' },
  { id: 'sqlite', label: 'SQLite', ext: 'sql', icon: '🪶' },
];

const CODE_TABS = [
  { id: 'sql', label: 'CREATE TABLE (SQL)', ext: 'sql' },
  { id: 'prisma', label: 'Prisma Schema', ext: 'prisma' },
  { id: 'typeorm', label: 'TypeORM (TypeScript)', ext: 'ts' },
  { id: 'sequelize', label: 'Sequelize (TypeScript)', ext: 'ts' },
];

export function CodeGeneratorView({ projectId }) {
  const [dialect, setDialect] = useState('postgresql');
  const [activeCodeTab, setActiveCodeTab] = useState('sql');
  const [codeData, setCodeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  // Diff View States
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [previousSnapshots, setPreviousSnapshots] = useState([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
  const [baselineCode, setBaselineCode] = useState('');

  // Load generated code from backend
  const fetchCode = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.generateErdCode(projectId, dialect);
      setCodeData(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  }, [projectId, dialect]);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  // Load version snapshots for diff comparison if available
  useEffect(() => {
    api.getProjectVersions(projectId)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setPreviousSnapshots(list);
        if (list.length > 0 && !selectedSnapshotId) {
          setSelectedSnapshotId(list[0].id);
        }
      })
      .catch(() => setPreviousSnapshots([]));
  }, [projectId, selectedSnapshotId]);

  // Get current active code snippet
  const activeCodeSnippet = useMemo(() => {
    if (!codeData) return '// Generating code...';
    switch (activeCodeTab) {
      case 'prisma':
        return codeData.prisma || '// No Prisma schema';
      case 'typeorm':
        return codeData.typeorm || '// No TypeORM models';
      case 'sequelize':
        return codeData.sequelize || '// No Sequelize models';
      case 'sql':
      default:
        return codeData.sql || '-- No SQL generated';
    }
  }, [codeData, activeCodeTab]);

  // Handle Save Baseline for Diff Comparison
  const handleSaveBaseline = () => {
    setBaselineCode(activeCodeSnippet);
    alert('Current code saved as baseline for Diff comparison!');
  };

  // Copy active code to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(activeCodeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download active file
  const handleDownload = () => {
    const ext = activeCodeTab === 'sql'
      ? 'sql'
      : activeCodeTab === 'prisma'
      ? 'prisma'
      : 'ts';

    const filename = activeCodeTab === 'sql'
      ? `schema-${dialect}-p${projectId}.${ext}`
      : activeCodeTab === 'prisma'
      ? `schema.prisma`
      : `${activeCodeTab}-models-p${projectId}.${ext}`;

    const blob = new Blob([activeCodeSnippet], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Simple clean line diff computation for Diff View
  const diffLines = useMemo(() => {
    if (!isDiffMode || !baselineCode) return [];
    const baseLines = baselineCode.split('\n');
    const currentLines = activeCodeSnippet.split('\n');

    const result = [];
    const maxLen = Math.max(baseLines.length, currentLines.length);

    for (let i = 0; i < maxLen; i++) {
      const b = baseLines[i];
      const c = currentLines[i];

      if (b === c) {
        result.push({ type: 'same', text: c ?? '', lineNum: i + 1 });
      } else if (b === undefined) {
        result.push({ type: 'added', text: c, lineNum: i + 1 });
      } else if (c === undefined) {
        result.push({ type: 'removed', text: b, lineNum: i + 1 });
      } else {
        result.push({ type: 'removed', text: b, lineNum: i + 1 });
        result.push({ type: 'added', text: c, lineNum: i + 1 });
      }
    }
    return result;
  }, [isDiffMode, baselineCode, activeCodeSnippet]);

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] min-h-[640px] bg-[#10141e] border border-[#22273b] rounded-lg overflow-hidden">
      {/* Top Controls Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#22273b] bg-[#161b26] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Code size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#dfe1e6] flex items-center gap-2">
              Module 6: SQL & Code Generator
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Multi-Dialect
              </span>
            </h2>
            <p className="text-xs text-[#8c9bab]">
              Export production DDL across 5 database engines, generate ready-to-use Prisma schemas, and produce TypeORM / Sequelize TypeScript models.
            </p>
          </div>
        </div>

        {/* Dialect Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#141923] p-1 rounded-lg border border-[#2e374f]">
            <span className="text-[11px] font-semibold text-[#8c9bab] px-2">Dialect:</span>
            {DIALECTS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDialect(d.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  dialect === d.id
                    ? 'bg-[#0c66e4] text-white shadow-xs'
                    : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1f2637]'
                }`}
              >
                <span>{d.icon}</span>
                <span>{d.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={fetchCode}
            className="p-1.5 rounded-lg bg-[#1c2230] border border-[#2e374f] text-[#8c9bab] hover:text-white hover:bg-[#252d40] transition-colors cursor-pointer"
            title="Re-generate Code"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Code Navigation & Actions Bar */}
      <div className="px-5 py-2.5 bg-[#141923] border-b border-[#22273b] flex items-center justify-between flex-wrap gap-2">
        {/* Model Framework Tabs */}
        <div className="flex items-center gap-1">
          {CODE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCodeTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeCodeTab === tab.id
                  ? 'bg-[#1e2638] text-[#579dff] border border-[#579dff]/40 shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Buttons: Diff View, Copy, Download */}
        <div className="flex items-center gap-2">
          {/* Diff Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (!isDiffMode && !baselineCode) {
                setBaselineCode(activeCodeSnippet);
              }
              setIsDiffMode(!isDiffMode);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
              isDiffMode
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-[#1c2230] border-[#2e374f] text-[#8c9bab] hover:text-[#dfe1e6]'
            }`}
            title="Compare against baseline or previously generated version"
          >
            <GitCompare size={13} />
            <span>Diff View {isDiffMode ? '(Active)' : ''}</span>
          </button>

          {isDiffMode && (
            <button
              type="button"
              onClick={handleSaveBaseline}
              className="px-2.5 py-1.5 rounded-md bg-[#1c2230] border border-[#2e374f] text-[11px] text-[#8c9bab] hover:text-[#dfe1e6] cursor-pointer"
              title="Save current code as new baseline"
            >
              Set As Baseline
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1c2230] hover:bg-[#252d40] border border-[#2e374f] text-xs font-semibold text-[#dfe1e6] transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download size={13} />
            <span>
              Download .{activeCodeTab === 'sql' ? 'sql' : activeCodeTab === 'prisma' ? 'prisma' : 'ts'}
            </span>
          </button>
        </div>
      </div>

      {/* Code / Diff Viewer Body */}
      <div className="flex-1 overflow-auto bg-[#0d1117] p-4 font-mono text-xs text-[#e6edf3]">
        {isDiffMode ? (
          <div>
            <div className="p-2 mb-3 bg-[#161b22] border border-[#30363d] rounded text-[11px] text-[#8c9bab] flex items-center justify-between">
              <span>
                Comparing against baseline (
                <span className="text-emerald-400 font-bold">+ added</span> /{' '}
                <span className="text-red-400 font-bold">- removed</span>)
              </span>
              <span className="text-[10px]">{diffLines.length} lines analyzed</span>
            </div>

            <div className="divide-y divide-[#21262d]">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`py-0.5 px-2 flex items-start gap-3 ${
                    line.type === 'added'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : line.type === 'removed'
                      ? 'bg-red-500/10 text-red-300'
                      : 'text-[#8b949e]'
                  }`}
                >
                  <span className="w-8 text-right text-[10px] text-[#484f58] select-none shrink-0">
                    {line.lineNum}
                  </span>
                  <span className="w-4 select-none font-bold text-center shrink-0">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="whitespace-pre overflow-x-auto flex-1 font-mono">
                    {line.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <pre className="leading-relaxed select-all overflow-x-auto">
            {activeCodeSnippet}
          </pre>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-2 border-t border-[#22273b] bg-[#141923] flex items-center justify-between text-[11px] text-[#626f86]">
        <span>
          Target Dialect: <strong className="text-[#dfe1e6] capitalize">{dialect}</strong> • Entities: {codeData?.totalEntities || 0} • Relationships: {codeData?.totalRelationships || 0}
        </span>
        <span className="font-mono">
          Ready for production deployment & schema migrations
        </span>
      </div>
    </div>
  );
}


import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Download,
  Check,
  FileCode,
  Table as TableIcon,
  Layers,
  ArrowRight,
  Filter,
  Eye,
  Sliders,
  Code2,
} from 'lucide-react';

export function NormalizationEngineView({ projectId, entities = [], relationships = [] }) {
  const [activeTab, setActiveTab] = useState('checker'); // 'checker' | 'comparison' | 'sql'
  const [auditReport, setAuditReport] = useState(null);
  const [denormData, setDenormData] = useState(null);
  const [sqlScripts, setSqlScripts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Table selection toggles for de-normalization
  const [selectedTableIds, setSelectedTableIds] = useState([]);

  // Fetch Normalization Audit, Denormalization, and SQL Scripts
  const loadEngineData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const [auditRes, denormRes, sqlRes] = await Promise.all([
        api.getErdNormalizationAudit(projectId),
        api.getErdDenormalizedSchema(projectId, selectedTableIds.length > 0 ? selectedTableIds : null),
        api.getErdSqlScripts(projectId, selectedTableIds.length > 0 ? selectedTableIds : null),
      ]);

      setAuditReport(auditRes.data);
      setDenormData(denormRes.data);
      setSqlScripts(sqlRes.data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load normalization engine data');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedTableIds]);

  useEffect(() => {
    loadEngineData();
  }, [loadEngineData]);

  // Handle table selection toggle
  const handleToggleTable = (entityId) => {
    setSelectedTableIds((prev) =>
      prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId]
    );
  };

  // Copy SQL script to clipboard
  const handleCopySql = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Download SQL as .sql file
  const handleDownloadSql = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] min-h-[640px] bg-[#10141e] border border-[#22273b] rounded-lg overflow-hidden">
      {/* Top Engine Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#22273b] bg-[#161b26] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#dfe1e6] flex items-center gap-2">
              Module 5: Normalization & De-normalization Engine
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                1NF / 2NF / 3NF & SQL Export
              </span>
            </h2>
            <p className="text-xs text-[#8c9bab]">
              Audit relational schemas for normal form compliance, generate flattened de-normalized reporting views, and export production PostgreSQL DDL scripts.
            </p>
          </div>
        </div>

        {/* Tab Controls & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#1a202e] p-1 rounded-lg border border-[#2e374f]">
            <button
              type="button"
              onClick={() => setActiveTab('checker')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'checker'
                  ? 'bg-[#0c66e4] text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              1NF / 2NF / 3NF Audit
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'comparison'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              Side-by-Side Schema View
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'sql'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              Export PostgreSQL DDL
            </button>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={loadEngineData}
            className="p-1.5 rounded bg-[#1c2230] border border-[#2e374f] text-[#8c9bab] hover:text-white hover:bg-[#252d40] transition-colors cursor-pointer"
            title="Refresh Analysis"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: NORMALIZATION CHECKER (1NF, 2NF, 3NF) */}
      {activeTab === 'checker' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Score Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#141923] border border-[#242b3d] flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-[#8c9bab] uppercase tracking-wider">
                  Schema Health Score
                </div>
                <div className="text-2xl font-mono font-bold mt-1 text-[#dfe1e6]">
                  <span
                    className={
                      (auditReport?.score || 0) >= 90
                        ? 'text-emerald-400'
                        : (auditReport?.score || 0) >= 70
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }
                  >
                    {auditReport?.score || 0}%
                  </span>
                  <span className="text-xs text-[#626f86] font-normal ml-1">/ 100</span>
                </div>
              </div>
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold font-mono text-sm border ${
                  (auditReport?.score || 0) >= 90
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                }`}
              >
                {(auditReport?.score || 0) >= 90 ? '3NF' : '2NF'}
              </div>
            </div>

            {/* 1NF Card */}
            <div className="p-4 rounded-xl bg-[#141923] border border-[#242b3d]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#dfe1e6]">1st Normal Form (1NF)</span>
                {auditReport?.firstNormalForm?.passed ? (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Passed
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                    Violations
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8c9bab]">
                Atomic attributes, presence of primary keys, no repeating column groups.
              </p>
              <div className="text-[11px] font-mono text-sky-400 mt-2">
                {auditReport?.firstNormalForm?.issues?.length || 0} issue(s) detected
              </div>
            </div>

            {/* 2NF Card */}
            <div className="p-4 rounded-xl bg-[#141923] border border-[#242b3d]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#dfe1e6]">2nd Normal Form (2NF)</span>
                {auditReport?.secondNormalForm?.passed ? (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Passed
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Violations
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8c9bab]">
                In 1NF and all non-key attributes fully depend on the entire primary key (no partial dependencies).
              </p>
              <div className="text-[11px] font-mono text-sky-400 mt-2">
                {auditReport?.secondNormalForm?.issues?.length || 0} issue(s) detected
              </div>
            </div>

            {/* 3NF Card */}
            <div className="p-4 rounded-xl bg-[#141923] border border-[#242b3d]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#dfe1e6]">3rd Normal Form (3NF)</span>
                {auditReport?.thirdNormalForm?.passed ? (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Passed
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Violations
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8c9bab]">
                In 2NF and no transitive functional dependencies (no non-key attribute depends on another non-key).
              </p>
              <div className="text-[11px] font-mono text-sky-400 mt-2">
                {auditReport?.thirdNormalForm?.issues?.length || 0} issue(s) detected
              </div>
            </div>
          </div>

          {/* Violations & Actionable Advice */}
          <div className="bg-[#141923] border border-[#22273b] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#22273b] bg-[#161b26] flex items-center justify-between">
              <h3 className="font-bold text-xs text-[#dfe1e6] flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-400" />
                <span>Detected Violations & Recommended Mitigations ({auditReport?.violations?.length || 0})</span>
              </h3>
            </div>

            <div className="divide-y divide-[#22273b]">
              {(auditReport?.violations || []).map((violation, index) => {
                const isCrit = violation.severity === 'critical';
                const isWarn = violation.severity === 'warning';

                return (
                  <div key={index} className="p-4 hover:bg-[#181d2a] transition-colors text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded border ${
                            isCrit
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : isWarn
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          }`}
                        >
                          {violation.nf} • {violation.type}
                        </span>

                        <span className="font-bold text-[#dfe1e6]">
                          Entity: <span className="font-mono text-sky-300">[{violation.entityName}]</span>
                        </span>
                      </div>

                      <span className="text-[10px] uppercase font-mono text-[#8c9bab]">
                        Severity: {violation.severity}
                      </span>
                    </div>

                    <p className="text-[#dfe1e6] font-medium leading-relaxed">
                      {violation.message}
                    </p>

                    <div className="p-2.5 rounded-lg bg-[#111520] border border-[#22273b] text-[11px] text-emerald-300 flex items-start gap-2">
                      <span className="font-bold text-emerald-400 shrink-0">💡 Remediation:</span>
                      <span>{violation.recommendation}</span>
                    </div>
                  </div>
                );
              })}

              {(auditReport?.violations || []).length === 0 && (
                <div className="p-10 text-center text-xs text-emerald-400 space-y-1">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                  <div className="font-bold text-sm text-[#dfe1e6]">No Normalization Violations Detected</div>
                  <p className="text-[#8c9bab] max-w-sm mx-auto">
                    Every entity is configured with a primary key, atomic attributes, proper foreign key relationships, and no partial or transitive dependencies.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIDE-BY-SIDE SCHEMA VIEW (Mirrors Image 7) */}
      {activeTab === 'comparison' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub-bar with Table Toggles */}
          <div className="p-3 border-b border-[#22273b] bg-[#161b26] flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#8c9bab] font-semibold">De-normalize Child Tables:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {entities.map((ent) => {
                  const isChecked = selectedTableIds.includes(ent.id);
                  return (
                    <button
                      key={ent.id}
                      type="button"
                      onClick={() => handleToggleTable(ent.id)}
                      className={`px-2 py-1 rounded border text-[11px] font-mono cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                          : 'bg-[#181d2a] border-[#2e374f] text-[#8c9bab] hover:text-[#dfe1e6]'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {ent.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <span className="text-[11px] text-[#626f86]">
              Flattens 1:M relationships by absorbing parent descriptive attributes into child tables.
            </span>
          </div>

          {/* Side-by-Side Comparison Container */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Normalized Schema (3NF) */}
            <div className="border border-[#22273b] rounded-xl bg-[#141923] overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-[#181d2a] border-b border-[#22273b] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon size={14} className="text-sky-400" />
                  <span className="font-bold text-xs text-[#dfe1e6]">Normalized Schema (3NF)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {denormData?.normalizedEntities?.length || 0} Tables
                </span>
              </div>

              <div className="p-3 space-y-4 overflow-y-auto flex-1">
                {(denormData?.normalizedEntities || []).map((table) => (
                  <div key={table.id} className="border border-[#242b3d] rounded-lg overflow-hidden bg-[#10141e]">
                    <div className="px-3 py-1.5 bg-[#18202f] border-b border-[#242b3d] flex items-center justify-between text-xs font-mono font-bold text-sky-300">
                      <span>{table.name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-sans">
                        {table.type}
                      </span>
                    </div>

                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-[#141923] text-[#626f86] border-b border-[#22273b]">
                          <th className="py-1 px-2.5">Column</th>
                          <th className="py-1 px-2.5">Type</th>
                          <th className="py-1 px-2.5">Key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2536]">
                        {(table.attributes || []).map((attr, idx) => (
                          <tr key={idx} className="hover:bg-[#161c28]">
                            <td className="py-1 px-2.5 font-mono text-[#dfe1e6]">{attr.name}</td>
                            <td className="py-1 px-2.5 text-[#8c9bab]">{attr.dataType}</td>
                            <td className="py-1 px-2.5">
                              {attr.keyType === 'PK' ? (
                                <span className="text-[9px] font-mono px-1 rounded bg-amber-500/20 text-amber-300">
                                  PK
                                </span>
                              ) : attr.keyType === 'FK' ? (
                                <span className="text-[9px] font-mono px-1 rounded bg-sky-500/20 text-sky-300">
                                  FK
                                </span>
                              ) : attr.keyType === 'Composite' ? (
                                <span className="text-[9px] font-mono px-1 rounded bg-purple-500/20 text-purple-300">
                                  Composite
                                </span>
                              ) : (
                                <span className="text-[#626f86]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: De-normalized Schema (Flattened Reporting) */}
            <div className="border border-purple-500/40 rounded-xl bg-[#141923] overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-[#1d172e] border-b border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-purple-400" />
                  <span className="font-bold text-xs text-purple-200">
                    De-normalized Schema (Flattened Read Models)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {denormData?.denormalizedTables?.length || 0} Tables
                </span>
              </div>

              <div className="p-3 space-y-4 overflow-y-auto flex-1">
                {(denormData?.denormalizedTables || []).map((table, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg overflow-hidden bg-[#10141e] ${
                      table.isDenormalized ? 'border-purple-500/40' : 'border-[#242b3d]'
                    }`}
                  >
                    <div className="px-3 py-1.5 bg-[#201934] border-b border-purple-500/30 flex items-center justify-between text-xs font-mono font-bold text-purple-300">
                      <span>{table.name}</span>
                      {table.absorbedParents?.length > 0 && (
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200">
                          Absorbed: {table.absorbedParents.join(', ')}
                        </span>
                      )}
                    </div>

                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-[#141923] text-[#626f86] border-b border-[#22273b]">
                          <th className="py-1 px-2.5">Column</th>
                          <th className="py-1 px-2.5">Type</th>
                          <th className="py-1 px-2.5">Origin / Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2536]">
                        {(table.attributes || []).map((attr, aIdx) => (
                          <tr
                            key={aIdx}
                            className={`hover:bg-[#19152b] ${
                              attr.origin === 'inherited' ? 'bg-purple-950/20' : ''
                            }`}
                          >
                            <td className="py-1 px-2.5 font-mono text-[#dfe1e6]">
                              {attr.name}
                            </td>
                            <td className="py-1 px-2.5 text-[#8c9bab]">{attr.dataType}</td>
                            <td className="py-1 px-2.5">
                              {attr.origin === 'inherited' ? (
                                <span className="text-[9px] font-mono px-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  Inherited from {attr.sourceTable}
                                </span>
                              ) : (
                                <span className="text-[#626f86] text-[10px]">Native</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXPORT POSTGRESQL DDL (Pure SQL Raw Scripts) */}
      {activeTab === 'sql' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Script 1: Normalized PostgreSQL DDL */}
          <div className="border border-[#22273b] rounded-xl bg-[#141923] overflow-hidden">
            <div className="px-5 py-3 bg-[#181d2a] border-b border-[#22273b] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 size={16} className="text-sky-400" />
                <h3 className="font-bold text-xs text-[#dfe1e6]">
                  Normalized PostgreSQL DDL Script (3NF Schema)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopySql(sqlScripts?.normalizedSql || '', 'norm')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#1c2230] hover:bg-[#252d40] border border-[#2e374f] text-xs text-[#dfe1e6] cursor-pointer"
                >
                  {copiedKey === 'norm' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedKey === 'norm' ? 'Copied!' : 'Copy SQL'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSql(sqlScripts?.normalizedSql || '', `normalized-schema-p${projectId}.sql`)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold cursor-pointer"
                >
                  <Download size={12} />
                  <span>Download .sql</span>
                </button>
              </div>
            </div>

            <pre className="p-4 bg-[#0d1017] text-[#a5d6ff] font-mono text-xs overflow-x-auto max-h-96 leading-relaxed select-all">
              {sqlScripts?.normalizedSql || '-- No SQL generated'}
            </pre>
          </div>

          {/* Script 2: De-normalized PostgreSQL DDL */}
          <div className="border border-purple-500/40 rounded-xl bg-[#141923] overflow-hidden">
            <div className="px-5 py-3 bg-[#1d172e] border-b border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 size={16} className="text-purple-400" />
                <h3 className="font-bold text-xs text-purple-200">
                  De-normalized PostgreSQL DDL Script (Read-Optimized Flattened Schema)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopySql(sqlScripts?.denormalizedSql || '', 'denorm')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#1c2230] hover:bg-[#252d40] border border-[#2e374f] text-xs text-[#dfe1e6] cursor-pointer"
                >
                  {copiedKey === 'denorm' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedKey === 'denorm' ? 'Copied!' : 'Copy SQL'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadSql(sqlScripts?.denormalizedSql || '', `denormalized-schema-p${projectId}.sql`)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Download size={12} />
                  <span>Download .sql</span>
                </button>
              </div>
            </div>

            <pre className="p-4 bg-[#0d1017] text-[#d2a8ff] font-mono text-xs overflow-x-auto max-h-96 leading-relaxed select-all">
              {sqlScripts?.denormalizedSql || '-- No SQL generated'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  Copy,
  Users,
  Eye,
  Calendar,
  Layers,
  ArrowRight,
  Send,
  Database,
  ChevronRight,
} from 'lucide-react';

export function ComplianceGovernanceView({ projectId }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'pii' | 'retention' | 'governance' | 'audit'
  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState(null);
  const [detectedPii, setDetectedPii] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [governance, setGovernance] = useState(null);
  const [retentionScript, setRetentionScript] = useState('');
  const [applyingPii, setApplyingPii] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Sign-off / Governance Form State
  const [govStatus, setGovStatus] = useState('in_review');
  const [govNotes, setGovNotes] = useState('');
  const [submittingGov, setSubmittingGov] = useState(false);

  const fetchComplianceData = useCallback(async () => {
    try {
      setLoading(true);
      const [scoreRes, piiRes, logsRes, govRes, scriptRes] = await Promise.all([
        api.getComplianceScore(projectId),
        api.scanPii(projectId),
        api.getAuditLogs(projectId),
        api.getGovernanceReview(projectId),
        api.getRetentionScript(projectId),
      ]);

      setScoreData(scoreRes.data);
      setDetectedPii(piiRes.data || []);
      setAuditLogs(logsRes.data || []);
      setGovernance(govRes.data);
      if (govRes.data) {
        setGovStatus(govRes.data.status || 'in_review');
        setGovNotes(govRes.data.notes || '');
      }
      setRetentionScript(scriptRes.data?.sql || '');
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  // Bulk Apply Detected PII Tags
  const handleApplyAllPii = async () => {
    try {
      setApplyingPii(true);
      const tagsToApply = detectedPii.map((item) => ({
        attributeId: item.attributeId,
        piiType: item.piiType,
        retentionDays: item.suggestedRetention,
      }));

      await api.applyPiiTags(projectId, tagsToApply);
      await fetchComplianceData();
      alert(`Applied PII tags and retention schedules to ${tagsToApply.length} columns!`);
    } catch (err) {
      alert(err.message || 'Failed to apply PII tags');
    } finally {
      setApplyingPii(false);
    }
  };

  // Update Governance Review State (Sign-off)
  const handleUpdateGovernance = async (e) => {
    e.preventDefault();
    try {
      setSubmittingGov(true);
      const res = await api.updateGovernanceReview(projectId, {
        status: govStatus,
        notes: govNotes,
        actor: 'Piko (Lead Architect)',
      });
      setGovernance(res.data);
      await fetchComplianceData();
      alert(`Governance review updated to '${govStatus}'!`);
    } catch (err) {
      alert(err.message || 'Failed to update review');
    } finally {
      setSubmittingGov(false);
    }
  };

  const copyRetentionSql = () => {
    navigator.clipboard.writeText(retentionScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  if (loading && !scoreData) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-[#8c9bab] bg-[#161b26] rounded-xl border border-[#22273b]">
        <RefreshCw size={28} className="animate-spin text-emerald-400 mb-3" />
        <span className="text-sm font-medium">Auditing GDPR, HIPAA, and SOC2 compliance rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Compliance Gauge */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#161b26] to-[#121620] border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Module 10 • Enterprise Governance
              </span>
              <span className="text-xs text-[#8c9bab]">GDPR • HIPAA • SOC2 Data Protection</span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" size={22} />
              Compliance, Privacy & Audit Center
            </h2>
            <p className="text-xs text-[#8c9bab] mt-1 max-w-2xl">
              Automatic PII identification, statutory retention schedule enforcement, immutable schema change audit trail, and manager sign-off workflows for enterprise readiness.
            </p>
          </div>

          {/* Compliance Scores Card */}
          <div className="flex items-center gap-4 bg-[#10141f] border border-[#22283b] p-3.5 rounded-xl">
            <div className="text-center pr-3 border-r border-[#22283b]">
              <div className="text-3xl font-extrabold text-emerald-400 font-mono">
                {scoreData?.complianceScore || 0}%
              </div>
              <div className="text-[10px] text-[#8c9bab] uppercase font-bold tracking-wider mt-0.5">
                Overall Score
              </div>
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8c9bab]">GDPR:</span>
                <span className="text-white font-bold">{scoreData?.gdprPercentage || 0}%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8c9bab]">HIPAA:</span>
                <span className="text-sky-400 font-bold">{scoreData?.hipaaPercentage || 0}%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#8c9bab]">SOC2:</span>
                <span className="text-indigo-400 font-bold">{scoreData?.soc2Percentage || 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-2 mt-6 border-b border-[#22283b] pb-2 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-white hover:bg-[#1a202e]'
            }`}
          >
            Compliance Checklist
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pii')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'pii'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-white hover:bg-[#1a202e]'
            }`}
          >
            <span>PII Discovery Scanner</span>
            <span className="px-1.5 py-0.2 bg-black/40 rounded text-[10px] font-mono text-emerald-300">
              {detectedPii.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('retention')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'retention'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-white hover:bg-[#1a202e]'
            }`}
          >
            Retention & SQL Purge
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'governance'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-white hover:bg-[#1a202e]'
            }`}
          >
            <span>Change Sign-off</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase ${
              governance?.status === 'approved'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}>
              {governance?.status || 'draft'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#8c9bab] hover:text-white hover:bg-[#1a202e]'
            }`}
          >
            Immutable Audit Trail
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & CHECKLIST */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(scoreData?.checklist || []).map((item) => (
              <div
                key={item.id}
                className="bg-[#161b26] border border-[#22273b] rounded-xl p-4 flex items-start gap-3 shadow-sm"
              >
                <div className="mt-0.5">
                  {item.status === 'PASS' ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#10141f] border border-[#232a3d] text-indigo-300">
                      {item.standard}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.status === 'PASS'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{item.title}</h4>
                  <p className="text-xs text-[#8c9bab]">{item.description}</p>
                  <div className="text-[11px] font-mono text-[#627084] pt-1 border-t border-[#1e2436]">
                    Status: {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PII DISCOVERY SCANNER */}
      {activeTab === 'pii' && (
        <div className="bg-[#161b26] border border-[#22273b] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock size={16} className="text-emerald-400" />
                PII (Personally Identifiable Information) Field Detector
              </h3>
              <p className="text-xs text-[#8c9bab] mt-0.5">
                Automatically flagged columns containing sensitive customer, financial, or authentication records.
              </p>
            </div>

            <button
              type="button"
              disabled={applyingPii || detectedPii.length === 0}
              onClick={handleApplyAllPii}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all cursor-pointer shadow-sm"
            >
              <Check size={13} className={applyingPii ? 'animate-spin' : ''} />
              <span>Apply PII Tags & Retention Schedules</span>
            </button>
          </div>

          {detectedPii.length === 0 ? (
            <div className="p-8 text-center text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              ✓ No unlabeled PII detected. All personal identifiers are properly tagged and protected.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#22283b]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#10141f] text-[#8c9bab] font-mono text-[11px] border-b border-[#22283b]">
                  <tr>
                    <th className="p-3">Entity & Column</th>
                    <th className="p-3">Data Type</th>
                    <th className="p-3">PII Classification</th>
                    <th className="p-3">Sensitivity</th>
                    <th className="p-3">GDPR Article</th>
                    <th className="p-3">Retention Schedule</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283b] bg-[#121622]">
                  {detectedPii.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#161c2b] transition-colors">
                      <td className="p-3 font-mono">
                        <span className="text-white font-bold">{item.entityName}</span>
                        <span className="text-[#627084]">.</span>
                        <span className="text-emerald-400">{item.attributeName}</span>
                      </td>
                      <td className="p-3 font-mono text-[#8c9bab]">{item.dataType}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {item.piiType}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.sensitivity === 'Critical'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {item.sensitivity}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[#8c9bab] text-[11px]">{item.gdprArticle}</td>
                      <td className="p-3 font-mono text-indigo-300 text-[11px]">
                        {item.suggestedRetention} days (~{Math.round(item.suggestedRetention / 365)} yrs)
                      </td>
                      <td className="p-3 text-right">
                        {item.isAlreadyTagged ? (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center justify-end gap-1">
                            <Check size={12} /> Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-bold">Unassigned</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DATA RETENTION RULES & SQL SCRIPT */}
      {activeTab === 'retention' && (
        <div className="bg-[#161b26] border border-[#22273b] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-indigo-400" />
                Automated Data Retention & Purge Script Generator
              </h3>
              <p className="text-xs text-[#8c9bab] mt-0.5">
                GDPR Article 5(1)(e) requires personal data to be kept in a form which permits identification for no longer than necessary.
              </p>
            </div>

            <button
              type="button"
              onClick={copyRetentionSql}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1a202e] border border-[#2c354d] text-white hover:bg-[#232c40] transition-colors cursor-pointer"
            >
              {copiedScript ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedScript ? 'Copied SQL' : 'Copy Retention SQL'}</span>
            </button>
          </div>

          <div className="bg-[#0b0e14] border border-[#1d2436] rounded-xl p-4 font-mono text-xs text-indigo-300 overflow-x-auto">
            <pre className="whitespace-pre">{retentionScript || '-- No retention rules configured.'}</pre>
          </div>
        </div>
      )}

      {/* TAB 4: CHANGE GOVERNANCE & APPROVAL WORKFLOW */}
      {activeTab === 'governance' && (
        <div className="bg-[#161b26] border border-[#22273b] rounded-xl p-5 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-purple-400" />
              Enterprise Schema Governance & Sign-off Workflow
            </h3>
            <p className="text-xs text-[#8c9bab] mt-0.5">
              Production schema changes require verification from the lead architect or compliance officer prior to migration.
            </p>
          </div>

          <form onSubmit={handleUpdateGovernance} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-[#8c9bab] mb-1">
                Governance Review Status
              </label>
              <select
                value={govStatus}
                onChange={(e) => setGovStatus(e.target.value)}
                className="w-full bg-[#10141f] border border-[#22283b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="draft">Draft (Work in progress)</option>
                <option value="in_review">In Review (Awaiting Architect Sign-off)</option>
                <option value="approved">Approved for Production Deployment</option>
                <option value="rejected">Rejected (Changes Required)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8c9bab] mb-1">
                Architecture Sign-off Notes & Rationale
              </label>
              <textarea
                rows={3}
                value={govNotes}
                onChange={(e) => setGovNotes(e.target.value)}
                placeholder="Explain compliance readiness, migration precautions, or review notes..."
                className="w-full bg-[#10141f] border border-[#22283b] rounded-lg p-3 text-xs text-white placeholder-[#627084] focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submittingGov}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Send size={13} className={submittingGov ? 'animate-spin' : ''} />
              <span>Record Governance Decision</span>
            </button>
          </form>

          {governance && (
            <div className="pt-4 border-t border-[#22283b] text-xs text-[#8c9bab] space-y-1 font-mono">
              <div>Last Decision by: <span className="text-white font-bold">{governance.requested_by || 'Piko'}</span></div>
              <div>Last Updated: <span className="text-white">{new Date(governance.updated_at).toLocaleString()}</span></div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: IMMUTABLE AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-[#161b26] border border-[#22273b] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                SOC2 / GDPR Immutable Schema Audit Trail
              </h3>
              <p className="text-xs text-[#8c9bab] mt-0.5">
                Every DDL mutation, version commit, revert, and compliance tag is immutably recorded for regulatory audits.
              </p>
            </div>
            <span className="text-xs font-mono text-[#8c9bab]">{auditLogs.length} entries</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#22283b]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#10141f] text-[#8c9bab] font-mono text-[11px] border-b border-[#22283b]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22283b] bg-[#121622]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[#627084]">
                      No audit log entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#161c2b] transition-colors font-mono">
                      <td className="p-3 text-[#8c9bab] text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-white font-medium">{log.entity_name || 'Schema Global'}</td>
                      <td className="p-3 text-emerald-400">{log.actor}</td>
                      <td className="p-3 text-[#8c9bab] text-[11px] max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


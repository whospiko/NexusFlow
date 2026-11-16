import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import * as jsondiffpatch from 'jsondiffpatch';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Copy,
  Download,
  RotateCcw,
  Eye,
  Layers,
  Database,
  Sliders,
  Check,
  X,
  Code,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Search,
} from 'lucide-react';

export function SchemaVersioningView({ projectId, onRefreshProject = null, onNavigateModule = null }) {
  const { user } = useAuth();

  // Navigation sub-tabs: 'history' | 'diff' | 'migration' | 'merge'
  const [activeTab, setActiveTab] = useState('history');

  // State
  const [branches, setBranches] = useState(['main']);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Commit Modal State
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [commitForm, setCommitForm] = useState({
    versionTag: '',
    title: '',
    rationale: '',
    branch: 'main',
  });
  const [committing, setCommitting] = useState(false);

  // New Branch Modal State
  const [isNewBranchModalOpen, setIsNewBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  // Inspect Modal State
  const [inspectVersion, setInspectVersion] = useState(null);

  // Diff Engine State
  const [diffBaseId, setDiffBaseId] = useState('');
  const [diffCompareId, setDiffCompareId] = useState('current');
  const [diffResult, setDiffResult] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState('visual'); // 'visual' | 'json'

  // Migration Engine State
  const [migrationBaseId, setMigrationBaseId] = useState('');
  const [migrationCompareId, setMigrationCompareId] = useState('current');
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [copiedUp, setCopiedUp] = useState(false);
  const [copiedDown, setCopiedDown] = useState(false);

  // Merge Engine State
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeRationale, setMergeRationale] = useState('');
  const [mergeResult, setMergeResult] = useState(null);
  const [merging, setMerging] = useState(false);

  // Fetch branches & versions
  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const [versRes, branchRes] = await Promise.all([
        api.getSchemaVersions(projectId, selectedBranch),
        api.getSchemaBranches(projectId),
      ]);
      setVersions(versRes.data || []);
      if (branchRes.data && branchRes.data.length > 0) {
        setBranches(branchRes.data);
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load schema versions');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedBranch]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Suggest next tag on open commit modal
  const handleOpenCommit = () => {
    let suggestedTag = 'v1.0';
    if (versions.length > 0) {
      const lastTag = versions[0].version_tag;
      const match = lastTag?.match(/v?(\d+)\.(\d+)/);
      if (match) {
        suggestedTag = `v${match[1]}.${parseInt(match[2], 10) + 1}`;
      } else {
        suggestedTag = `v${versions.length + 1}.0`;
      }
    }
    setCommitForm({
      versionTag: suggestedTag,
      title: '',
      rationale: '',
      branch: selectedBranch,
    });
    setIsCommitModalOpen(true);
  };

  // Submit Commit
  const handleSubmitCommit = async (e) => {
    e.preventDefault();
    if (!commitForm.title.trim()) {
      alert('Commit message / title is required');
      return;
    }
    try {
      setCommitting(true);
      await api.commitSchemaVersion(projectId, {
        branch: commitForm.branch || selectedBranch,
        versionTag: commitForm.versionTag.trim() || undefined,
        title: commitForm.title.trim(),
        rationale: commitForm.rationale.trim() || undefined,
        author: user?.name || 'Piko',
      });
      setIsCommitModalOpen(false);
      setSuccessMsg(`Schema snapshot committed successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadVersions();
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      alert(err.message || 'Failed to commit schema version');
    } finally {
      setCommitting(false);
    }
  };

  // Create New Branch
  const handleCreateBranch = (e) => {
    e.preventDefault();
    const clean = newBranchName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean) return;
    if (!branches.includes(clean)) {
      setBranches((prev) => [...prev, clean]);
    }
    setSelectedBranch(clean);
    setIsNewBranchModalOpen(false);
    setNewBranchName('');
  };

  // Run Visual Diff
  const handleRunDiff = async (baseId, compareId) => {
    try {
      setDiffLoading(true);
      const res = await api.compareSchemaVersions(projectId, {
        baseVersionId: baseId || diffBaseId,
        compareVersionId: compareId || diffCompareId,
      });
      setDiffResult(res.data);
      setActiveTab('diff');
    } catch (err) {
      alert(err.message || 'Diff calculation failed');
    } finally {
      setDiffLoading(false);
    }
  };

  // Run Migration Generator
  const handleGenerateMigration = async (baseId, compareId) => {
    try {
      setMigrationLoading(true);
      const res = await api.generateSchemaMigration(projectId, {
        baseVersionId: baseId || migrationBaseId,
        compareVersionId: compareId || migrationCompareId,
        author: user?.name || 'Piko',
      });
      setMigrationResult(res.data);
      setActiveTab('migration');
    } catch (err) {
      alert(err.message || 'Migration generation failed');
    } finally {
      setMigrationLoading(false);
    }
  };

  // Run Branch Merge
  const handleRunMerge = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      alert('Please select both source and target versions');
      return;
    }
    try {
      setMerging(true);
      const res = await api.mergeSchemaBranches(projectId, {
        sourceVersionId: mergeSourceId,
        targetVersionId: mergeTargetId,
        targetBranch: selectedBranch,
        author: user?.name || 'Piko',
        rationale: mergeRationale.trim() || undefined,
      });
      setMergeResult(res.data);
      if (res.data?.success) {
        setSuccessMsg('Branch merged successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
        await loadVersions();
        if (onRefreshProject) onRefreshProject();
      }
    } catch (err) {
      alert(err.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  // Restore / Rollback Live Canvas to Version
  const handleRestoreVersion = async (version) => {
    if (version.has_schema === false) {
      alert(`Snapshot '${version.version_tag || version.commit_hash}' is a project tasks snapshot and does not contain database schema tables. Reverting is disabled to protect your current ERD schema.`);
      return;
    }

    const confirmMsg = `Are you sure you want to revert your live ERD canvas to snapshot '${version.version_tag || version.commit_hash}'? Any unsaved live edits will be replaced.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.restoreSchemaVersion(projectId, version.id);
      const msg = res.data?.message || `Canvas successfully reverted to '${version.version_tag}'!`;
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 5000);
      if (onRefreshProject) await onRefreshProject();
      await loadVersions();
      if (onNavigateModule) {
        onNavigateModule('canvas');
      }
    } catch (err) {
      alert(err.data?.message || err.message || 'Restore failed');
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'up') {
      setCopiedUp(true);
      setTimeout(() => setCopiedUp(false), 2000);
    } else {
      setCopiedDown(true);
      setTimeout(() => setCopiedDown(false), 2000);
    }
  };

  const downloadSql = (sqlText, filename) => {
    const blob = new Blob([sqlText], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Compute jsondiffpatch delta for deep inspection
  const computedJsonDelta = React.useMemo(() => {
    if (!diffResult?.baseSnapshot || !diffResult?.compareSnapshot) return null;
    try {
      return jsondiffpatch.diff(diffResult.baseSnapshot, diffResult.compareSnapshot);
    } catch {
      return null;
    }
  }, [diffResult]);

  return (
    <div className="space-y-5">
      {/* Top Banner & Git Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-[#141923] border border-[#242c40] rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <GitBranch size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#dfe1e6]">
                Schema Versioning & Git Engine
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                Git for Databases
              </span>
            </div>
            <p className="text-xs text-[#8c9bab] mt-0.5">
              Snapshot on save, visual schema diff, ALTER TABLE migration generator & branch merge
            </p>
          </div>
        </div>

        {/* Branch Selector & Commit Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch Picker */}
          <div className="flex items-center bg-[#1b2232] border border-[#2e374f] rounded-lg px-2.5 py-1.5 text-xs text-[#dfe1e6]">
            <GitBranch size={14} className="text-purple-400 mr-1.5 shrink-0" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer pr-2"
            >
              {branches.map((b) => (
                <option key={b} value={b} className="bg-[#1b2232] text-white">
                  branch: {b}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsNewBranchModalOpen(true)}
              className="text-[#8c9bab] hover:text-white ml-1 p-0.5 rounded hover:bg-black/30"
              title="Create new branch"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Commit Button */}
          <button
            type="button"
            onClick={handleOpenCommit}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <GitCommit size={14} />
            <span>Commit Schema</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sub-Tabs: Commits Timeline | Visual Diff | Migration Generator | Branch Merge */}
      <div className="flex items-center gap-1 bg-[#121622] p-1.5 rounded-xl border border-[#22273b] text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
          }`}
        >
          <Clock size={14} />
          <span>Commit Log ({versions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('diff');
            if (!diffResult && versions.length > 0) {
              handleRunDiff(versions[0]?.id, 'current');
            }
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'diff'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
          }`}
        >
          <Sliders size={14} />
          <span>Visual Diff</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('migration');
            if (!migrationResult && versions.length > 0) {
              handleGenerateMigration(versions[0]?.id, 'current');
            }
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'migration'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
          }`}
        >
          <FileCode size={14} />
          <span>Migration Generator</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('merge')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'merge'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
          }`}
        >
          <GitMerge size={14} />
          <span>Branch & Merge</span>
        </button>
      </div>

      {/* TAB 1: COMMIT LOG TIMELINE */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {loading && (
            <div className="py-12 text-center text-[#8c9bab] text-xs">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-purple-400" />
              <span>Loading schema commits...</span>
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="py-12 text-center bg-[#141923] border border-dashed border-[#242c40] rounded-xl">
              <GitCommit size={32} className="mx-auto mb-2 text-[#626f86]" />
              <h3 className="text-sm font-bold text-[#dfe1e6] mb-1">No Schema Commits on '{selectedBranch}'</h3>
              <p className="text-xs text-[#8c9bab] max-w-md mx-auto mb-4">
                Click "Commit Schema" to take your first immutable database snapshot with rationale and diff tracking.
              </p>
              <button
                type="button"
                onClick={handleOpenCommit}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Plus size={14} />
                <span>Create Initial Snapshot</span>
              </button>
            </div>
          )}

          {!loading &&
            versions.map((version, index) => {
              const previousVersion = versions[index + 1] || null;
              const metrics = version.metrics || {};
              const dateStr = new Date(version.created_at).toLocaleString();

              return (
                <div
                  key={version.id}
                  className="bg-[#141923] border border-[#242c40] hover:border-[#384564] rounded-xl p-4 transition-all shadow-md space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {version.version_tag || `commit`}
                      </span>
                      <span className="font-mono text-[11px] text-[#8c9bab] bg-black/30 px-1.5 py-0.5 rounded">
                        {version.commit_hash || `c-${version.id}`}
                      </span>
                      <span className="text-xs font-bold text-[#dfe1e6]">
                        {version.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#8c9bab]">
                      <span>by <strong className="text-[#dfe1e6]">{version.created_by}</strong></span>
                      <span>•</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Rationale / Explanation Box */}
                  <div className="p-2.5 rounded-lg bg-[#192030] border border-[#27324c] text-xs text-[#c2cddc]">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-purple-300 mb-0.5 flex items-center gap-1">
                      <HelpCircle size={11} />
                      <span>Rationale / Why was this changed?</span>
                    </div>
                    <p className="italic">{version.rationale || version.description || 'No rationale specified'}</p>
                  </div>

                  {/* Schema Metrics Pills & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-[#1e2538]">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#8c9bab]">
                      {version.has_schema !== false ? (
                        <>
                          <span className="flex items-center gap-1">
                            <Database size={12} className="text-sky-400" />
                            <span>{metrics.totalTables ?? 0} Tables</span>
                          </span>
                          <span>•</span>
                          <span>{metrics.totalColumns ?? 0} Columns</span>
                          <span>•</span>
                          <span>{metrics.totalRelationships ?? 0} Foreign Keys</span>
                        </>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-sans font-medium text-[10px]">
                          Project Tasks Snapshot (No Schema Tables)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRunDiff(version.id, 'current')}
                        className="px-2.5 py-1 rounded bg-[#1e2538] hover:bg-[#2b3550] text-[#dfe1e6] hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                        title="Compare this snapshot with current live canvas"
                      >
                        <Sliders size={12} className="text-sky-400" />
                        <span>Diff vs Current</span>
                      </button>

                      {previousVersion && (
                        <button
                          type="button"
                          onClick={() => handleRunDiff(previousVersion.id, version.id)}
                          className="px-2.5 py-1 rounded bg-[#1e2538] hover:bg-[#2b3550] text-[#dfe1e6] hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                          title="Compare with previous version"
                        >
                          <ArrowRight size={12} className="text-purple-400" />
                          <span>Diff vs {previousVersion.version_tag}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleGenerateMigration(version.id, 'current')}
                        className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                        title="Generate ALTER TABLE SQL"
                      >
                        <FileCode size={12} className="text-emerald-400" />
                        <span>Migration SQL</span>
                      </button>

                      <button
                        type="button"
                        disabled={version.has_schema === false}
                        onClick={() => handleRestoreVersion(version)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                          version.has_schema === false
                            ? 'bg-gray-800/40 text-gray-500 border border-gray-700/30 cursor-not-allowed opacity-50'
                            : 'bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 cursor-pointer'
                        }`}
                        title={
                          version.has_schema === false
                            ? 'Cannot revert: this snapshot is for project tasks and has no ERD tables'
                            : 'Revert live canvas to this version snapshot'
                        }
                      >
                        <RotateCcw size={12} />
                        <span>Revert Canvas</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* TAB 2: VISUAL DIFF ENGINE */}
      {activeTab === 'diff' && (
        <div className="space-y-4">
          {/* Comparison Selector Bar */}
          <div className="p-3 bg-[#141923] border border-[#242c40] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#dfe1e6]">Base Version:</span>
              <select
                value={diffBaseId}
                onChange={(e) => setDiffBaseId(e.target.value)}
                className="bg-[#1b2232] border border-[#2e374f] rounded-lg px-2.5 py-1 text-[#dfe1e6] focus:outline-none"
              >
                <option value="">Select Base Snapshot...</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_tag} - {v.title}
                  </option>
                ))}
              </select>

              <ArrowRight size={14} className="text-[#8c9bab]" />

              <span className="font-bold text-[#dfe1e6]">Compare With:</span>
              <select
                value={diffCompareId}
                onChange={(e) => setDiffCompareId(e.target.value)}
                className="bg-[#1b2232] border border-[#2e374f] rounded-lg px-2.5 py-1 text-[#dfe1e6] focus:outline-none"
              >
                <option value="current">Current Live Canvas Draft</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_tag} - {v.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={diffLoading || !diffBaseId}
                onClick={() => handleRunDiff(diffBaseId, diffCompareId)}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                {diffLoading ? <RefreshCw size={12} className="animate-spin" /> : <Sliders size={12} />}
                <span>Calculate Diff</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#1a202e] p-1 rounded-lg border border-[#283248]">
              <button
                type="button"
                onClick={() => setDiffViewMode('visual')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  diffViewMode === 'visual' ? 'bg-sky-600 text-white' : 'text-[#8c9bab]'
                }`}
              >
                Visual Cards
              </button>
              <button
                type="button"
                onClick={() => setDiffViewMode('json')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  diffViewMode === 'json' ? 'bg-sky-600 text-white' : 'text-[#8c9bab]'
                }`}
              >
                JSON Delta
              </button>
            </div>
          </div>

          {/* Diff Result Summary Banner */}
          {diffResult && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#172030] border border-sky-500/30 rounded-xl">
                <div className="text-[11px] uppercase tracking-wider font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>Schema Changelog Summary</span>
                </div>
                <div className="text-xs font-medium text-white leading-relaxed">
                  {diffResult.diff?.changelogText}
                </div>
              </div>

              {diffViewMode === 'visual' && (
                <div className="space-y-4">
                  {/* Added Tables */}
                  {diffResult.diff?.entities?.added?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Added Tables ({diffResult.diff.entities.added.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {diffResult.diff.entities.added.map((e) => (
                          <div
                            key={e.name}
                            className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-300 text-xs font-mono uppercase">
                                + {e.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded">
                                {e.type || 'Strong'}
                              </span>
                            </div>
                            <div className="divide-y divide-emerald-500/10 text-[11px]">
                              {e.attributes?.map((attr) => (
                                <div key={attr.name} className="py-1 flex justify-between font-mono text-emerald-200/80">
                                  <span>{attr.name}</span>
                                  <span className="text-emerald-400/60">{attr.dataType}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Removed Tables */}
                  {diffResult.diff?.entities?.removed?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>Removed Tables ({diffResult.diff.entities.removed.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {diffResult.diff.entities.removed.map((e) => (
                          <div
                            key={e.name}
                            className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-3 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-rose-300 font-mono line-through">
                              - {e.name}
                            </span>
                            <span className="text-[10px] font-mono text-rose-400">
                              {e.attributeCount} columns deleted
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modified Tables */}
                  {diffResult.diff?.entities?.modified?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Modified Tables ({diffResult.diff.entities.modified.length})</span>
                      </div>
                      <div className="space-y-3">
                        {diffResult.diff.entities.modified.map((m) => (
                          <div
                            key={m.name}
                            className="bg-[#141923] border border-amber-500/30 rounded-xl p-3.5 space-y-2.5 text-xs"
                          >
                            <div className="font-bold text-[#dfe1e6] flex items-center justify-between">
                              <span className="font-mono text-amber-300">TABLE {m.name}</span>
                              <span className="text-[10px] text-[#8c9bab]">
                                {m.addedAttrs.length} added • {m.removedAttrs.length} removed • {m.modifiedAttrs.length} modified
                              </span>
                            </div>

                            <div className="space-y-1.5 divide-y divide-[#1e2538]">
                              {/* Added Columns */}
                              {m.addedAttrs.map((a) => (
                                <div key={a.name} className="pt-1.5 flex items-center justify-between text-emerald-300 font-mono text-[11px]">
                                  <span className="flex items-center gap-1">
                                    <span className="font-bold">+</span>
                                    <span>{a.name}</span>
                                  </span>
                                  <span className="text-emerald-400/80">{a.dataType}</span>
                                </div>
                              ))}

                              {/* Removed Columns */}
                              {m.removedAttrs.map((a) => (
                                <div key={a.name} className="pt-1.5 flex items-center justify-between text-rose-300 font-mono text-[11px] line-through">
                                  <span className="flex items-center gap-1">
                                    <span className="font-bold">-</span>
                                    <span>{a.name}</span>
                                  </span>
                                  <span className="text-rose-400/80">{a.dataType}</span>
                                </div>
                              ))}

                              {/* Modified Columns */}
                              {m.modifiedAttrs.map((ma) => (
                                <div key={ma.name} className="pt-1.5 flex items-center justify-between text-amber-200 font-mono text-[11px]">
                                  <span className="flex items-center gap-1">
                                    <span className="font-bold">~</span>
                                    <span>{ma.name}</span>
                                  </span>
                                  <span className="text-amber-400 text-[10px]">
                                    {ma.changes?.join('; ')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!diffResult.diff?.hasChanges && (
                    <div className="py-8 text-center bg-[#141923] border border-[#242c40] rounded-xl text-xs text-[#8c9bab]">
                      <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-400" />
                      <span>Identical schemas! No structural differences found between the two versions.</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: JSON Delta using jsondiffpatch */}
              {diffViewMode === 'json' && (
                <div className="p-4 bg-[#0d1117] border border-[#242c40] rounded-xl overflow-x-auto text-xs font-mono text-emerald-400">
                  <pre>{JSON.stringify(computedJsonDelta || diffResult.diff, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MIGRATION SCRIPT GENERATOR */}
      {activeTab === 'migration' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-3 bg-[#141923] border border-[#242c40] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#dfe1e6]">From Version:</span>
              <select
                value={migrationBaseId}
                onChange={(e) => setMigrationBaseId(e.target.value)}
                className="bg-[#1b2232] border border-[#2e374f] rounded-lg px-2.5 py-1 text-[#dfe1e6] focus:outline-none"
              >
                <option value="">Select Base Snapshot...</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_tag} - {v.title}
                  </option>
                ))}
              </select>

              <ArrowRight size={14} className="text-[#8c9bab]" />

              <span className="font-bold text-[#dfe1e6]">To Version:</span>
              <select
                value={migrationCompareId}
                onChange={(e) => setMigrationCompareId(e.target.value)}
                className="bg-[#1b2232] border border-[#2e374f] rounded-lg px-2.5 py-1 text-[#dfe1e6] focus:outline-none"
              >
                <option value="current">Current Live Canvas Draft</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_tag} - {v.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={migrationLoading || !migrationBaseId}
                onClick={() => handleGenerateMigration(migrationBaseId, migrationCompareId)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                {migrationLoading ? <RefreshCw size={12} className="animate-spin" /> : <FileCode size={12} />}
                <span>Generate ALTER TABLE SQL</span>
              </button>
            </div>
          </div>

          {migrationResult && (
            <div className="space-y-4">
              {/* Warnings Banner */}
              {migrationResult.warnings?.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Destructive Operations Warning</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-200/80 space-y-0.5">
                    {migrationResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* UP Migration (Forward) */}
              <div className="bg-[#10141e] border border-[#242c40] rounded-xl overflow-hidden shadow-xl">
                <div className="px-4 py-2.5 bg-[#171d2b] border-b border-[#242c40] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-white font-mono">UP Migration (Apply Schema)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(migrationResult.upSql, 'up')}
                      className="px-2.5 py-1 rounded bg-[#20293d] hover:bg-[#2b3752] text-xs text-[#dfe1e6] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedUp ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedUp ? 'Copied!' : 'Copy SQL'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadSql(migrationResult.upSql, `migration-up-${Date.now()}.sql`)}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download size={12} />
                      <span>Download .sql</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-96 overflow-y-auto font-mono text-xs text-[#a5d6ff] bg-[#0c1018]">
                  <pre className="whitespace-pre-wrap">{migrationResult.upSql}</pre>
                </div>
              </div>

              {/* DOWN Migration (Rollback) */}
              <div className="bg-[#10141e] border border-[#242c40] rounded-xl overflow-hidden shadow-xl">
                <div className="px-4 py-2.5 bg-[#171d2b] border-b border-[#242c40] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="text-xs font-bold text-white font-mono">DOWN Migration (Rollback)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(migrationResult.downSql, 'down')}
                      className="px-2.5 py-1 rounded bg-[#20293d] hover:bg-[#2b3752] text-xs text-[#dfe1e6] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedDown ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedDown ? 'Copied!' : 'Copy SQL'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadSql(migrationResult.downSql, `migration-down-${Date.now()}.sql`)}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-xs text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download size={12} />
                      <span>Download .sql</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-80 overflow-y-auto font-mono text-xs text-[#fca5a5] bg-[#0c1018]">
                  <pre className="whitespace-pre-wrap">{migrationResult.downSql}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BRANCH & MERGE (GIT MERGE FOR DATABASES) */}
      {activeTab === 'merge' && (
        <div className="space-y-4">
          <div className="p-4 bg-[#141923] border border-[#242c40] rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#dfe1e6] flex items-center gap-1.5">
                <GitMerge size={16} className="text-indigo-400" />
                <span>3-Way Schema Branch Merge</span>
              </h3>
              <p className="text-xs text-[#8c9bab] mt-0.5">
                Merge database changes from a feature branch into your target branch with automatic conflict detection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-[#dfe1e6] mb-1">Source Version / Branch:</label>
                <select
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  className="w-full bg-[#1b2232] border border-[#2e374f] rounded-lg p-2 text-[#dfe1e6] focus:outline-none"
                >
                  <option value="">Select Source Snapshot...</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      [{v.branch}] {v.version_tag} - {v.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#dfe1e6] mb-1">Target Version / Branch:</label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full bg-[#1b2232] border border-[#2e374f] rounded-lg p-2 text-[#dfe1e6] focus:outline-none"
                >
                  <option value="">Select Target Snapshot...</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      [{v.branch}] {v.version_tag} - {v.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#dfe1e6] mb-1">Merge Rationale / Description:</label>
              <textarea
                value={mergeRationale}
                onChange={(e) => setMergeRationale(e.target.value)}
                placeholder="Explain why this merge is being performed (e.g. Completed billing module, integrating into main)..."
                rows={2}
                className="w-full bg-[#1b2232] border border-[#2e374f] rounded-lg p-2 text-xs text-[#dfe1e6] focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={merging || !mergeSourceId || !mergeTargetId}
              onClick={handleRunMerge}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              {merging ? <RefreshCw size={13} className="animate-spin" /> : <GitMerge size={13} />}
              <span>Execute 3-Way Schema Merge</span>
            </button>
          </div>

          {/* Merge Result Banner & Conflict Resolver */}
          {mergeResult && (
            <div className="space-y-3">
              {mergeResult.hasConflicts ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    <span>Merge Conflicts Detected!</span>
                  </div>
                  <p className="text-xs text-rose-200/80">
                    The two schema branches modified the same attributes incompatibly. Review the conflicts below:
                  </p>
                  <div className="space-y-2">
                    {mergeResult.conflicts?.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-black/40 border border-rose-500/20 text-xs font-mono space-y-1"
                      >
                        <div className="text-rose-300 font-bold">
                          Conflict in table '{c.tableName}' column '{c.attributeName}'
                        </div>
                        <div className="text-[#8c9bab] text-[11px]">
                          Target Branch Value: <span className="text-sky-300">{c.targetValue}</span> | Source Branch Value: <span className="text-purple-300">{c.sourceValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 size={16} />
                    <span>Fast-Forward Merge Successful!</span>
                  </div>
                  <p className="text-xs text-emerald-200/80">
                    All entities, attributes, and foreign keys merged cleanly into target branch '{selectedBranch}'.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COMMIT MODAL */}
      {isCommitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161c28] border border-[#2b354d] rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#242c40]">
              <div className="flex items-center gap-2">
                <GitCommit size={18} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">Commit Schema Snapshot</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCommitModalOpen(false)}
                className="text-[#8c9bab] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitCommit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#dfe1e6] mb-1">Target Branch:</label>
                  <input
                    type="text"
                    value={commitForm.branch}
                    onChange={(e) => setCommitForm({ ...commitForm, branch: e.target.value })}
                    className="w-full bg-[#121620] border border-[#252f44] rounded-lg p-2 text-white font-mono focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#dfe1e6] mb-1">Version Tag (e.g. v1.2):</label>
                  <input
                    type="text"
                    value={commitForm.versionTag}
                    onChange={(e) => setCommitForm({ ...commitForm, versionTag: e.target.value })}
                    className="w-full bg-[#121620] border border-[#252f44] rounded-lg p-2 text-white font-mono focus:outline-none"
                    placeholder="v1.2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#dfe1e6] mb-1">Commit Message / Title:</label>
                <input
                  type="text"
                  value={commitForm.title}
                  onChange={(e) => setCommitForm({ ...commitForm, title: e.target.value })}
                  placeholder="e.g. Added PaymentMethod to INVOICE; removed PhoneNumber from CUSTOMER"
                  className="w-full bg-[#121620] border border-[#252f44] rounded-lg p-2 text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#dfe1e6] mb-1">
                  Rationale ("Why was this changed?"):
                </label>
                <textarea
                  value={commitForm.rationale}
                  onChange={(e) => setCommitForm({ ...commitForm, rationale: e.target.value })}
                  placeholder="Explain why this database schema modification was necessary for your team..."
                  rows={3}
                  className="w-full bg-[#121620] border border-[#252f44] rounded-lg p-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242c40]">
                <button
                  type="button"
                  onClick={() => setIsCommitModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#20293d] hover:bg-[#2a3650] text-[#dfe1e6] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={committing}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-md"
                >
                  {committing ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Commit Snapshot</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW BRANCH MODAL */}
      {isNewBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161c28] border border-[#2b354d] rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#242c40]">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">Create New Schema Branch</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewBranchModalOpen(false)}
                className="text-[#8c9bab] hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#dfe1e6] mb-1">Branch Name:</label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. feature/payments, billing-v2, staging"
                  className="w-full bg-[#121620] border border-[#252f44] rounded-lg p-2 text-white font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#242c40]">
                <button
                  type="button"
                  onClick={() => setIsNewBranchModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#20293d] hover:bg-[#2a3650] text-[#dfe1e6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


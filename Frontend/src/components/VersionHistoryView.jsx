import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Plus,
  Clock,
  Layers,
  CheckCircle2,
  ListTodo,
  Network,
  Users,
  Eye,
  RotateCcw,
  Trash2,
  X,
  FileCode,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../services/api.js';

export function VersionHistoryView({ projectId, project, onNavigateToProject }) {
  const { t, language } = useLanguage();

  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inspectVersion, setInspectVersion] = useState(null);
  const [restoreModalVersion, setRestoreModalVersion] = useState(null);

  // Create form state
  const [newTag, setNewTag] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Restore form state
  const [restoreMode, setRestoreMode] = useState('branch'); // 'branch' or 'overwrite'
  const [branchName, setBranchName] = useState('');
  const [branchKey, setBranchKey] = useState('');
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [restoreError, setRestoreError] = useState(null);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getProjectVersions(projectId);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setVersions(list);
    } catch (err) {
      setError(err.data?.message || err.message || 'Failed to load version snapshots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchVersions();
    }
  }, [projectId]);

  const handleOpenCreate = () => {
    // Generate intelligent default tag based on existing versions
    let suggestedTag = 'v1.0';
    if (versions.length > 0) {
      const lastTag = versions[0].version_tag;
      const match = lastTag.match(/v?(\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10) + 1;
        suggestedTag = `v${major}.${minor}`;
      } else {
        suggestedTag = `v${versions.length + 1}.0`;
      }
    }
    setNewTag(suggestedTag);
    setNewTitle('');
    setNewDescription('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!newTag.trim()) {
      setFormError(t('versionHistory.snapshotTag') + ' ' + t('common.required'));
      return;
    }

    setCreateSubmitting(true);
    setFormError(null);

    try {
      await api.createProjectVersion(projectId, {
        version_tag: newTag.trim(),
        versionTag: newTag.trim(),
        title: newTitle.trim() || `Snapshot ${newTag.trim()}`,
        description: newDescription.trim() || undefined,
      });
      setIsCreateOpen(false);
      await fetchVersions();
    } catch (err) {
      setFormError(err.data?.message || err.message || 'Failed to create snapshot');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleDeleteSnapshot = async (version) => {
    const confirmMsg = t('versionHistory.confirmDelete', { tag: version.version_tag }) ||
      `Are you sure you want to delete snapshot ${version.version_tag}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteProjectVersion(projectId, version.id);
      await fetchVersions();
    } catch (err) {
      alert(err.data?.message || err.message || 'Failed to delete snapshot');
    }
  };

  const handleOpenRestore = (version) => {
    setRestoreModalVersion(version);
    setRestoreMode('branch');
    setBranchName(`${project.name} (${version.version_tag})`);
    setBranchKey('');
    setRestoreError(null);
  };

  const handleExecuteRestore = async (e) => {
    e.preventDefault();
    if (restoreMode === 'overwrite') {
      const confirmMsg = t('versionHistory.restoreConfirmWarning');
      if (!window.confirm(confirmMsg)) return;
    }

    setRestoreSubmitting(true);
    setRestoreError(null);

    try {
      const payload = {
        mode: restoreMode,
        newName: branchName.trim() || undefined,
        newProjectName: branchName.trim() || undefined,
        newKey: branchKey.trim().toUpperCase() || undefined,
      };

      const result = await api.restoreProjectVersion(projectId, restoreModalVersion.id, payload);
      setRestoreModalVersion(null);

      const targetProject = result?.project || result?.data;
      if (restoreMode === 'branch' && targetProject && onNavigateToProject) {
        onNavigateToProject(targetProject.id);
      } else {
        // Overwrite mode -> reload current page / versions
        window.location.reload();
      }
    } catch (err) {
      setRestoreError(err.data?.message || err.message || 'Restore failed');
    } finally {
      setRestoreSubmitting(false);
    }
  };

  const handleInspect = async (version) => {
    try {
      const full = await api.getProjectVersion(projectId, version.id);
      setInspectVersion(full?.data || full);
    } catch (err) {
      alert(err.data?.message || err.message || 'Failed to load snapshot details');
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-[#181d28] border border-[#283046] rounded-xl shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shrink-0">
            <GitBranch size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#dfe1e6] flex items-center gap-2">
              <span>{t('versionHistory.title')}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                {versions.length} Snapshots
              </span>
            </h2>
            <p className="text-xs text-[#8c9bab] mt-0.5 max-w-2xl">
              {t('versionHistory.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
        >
          <Plus size={15} />
          <span>{t('versionHistory.createBtn')}</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-12 text-center text-[#8c9bab] text-xs">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent mb-3" />
          <p>{t('common.loading')}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#e5493a]/15 border border-[#e5493a]/30 rounded-xl text-xs text-[#f87168] flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && versions.length === 0 && (
        <div className="p-12 text-center bg-[#181d28]/60 border border-dashed border-[#2e374f] rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
            <GitBranch size={24} />
          </div>
          <h3 className="text-sm font-bold text-[#dfe1e6] mb-1">{t('versionHistory.emptyTitle')}</h3>
          <p className="text-xs text-[#8c9bab] max-w-md mx-auto mb-4">{t('versionHistory.emptyDesc')}</p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>{t('versionHistory.createBtn')}</span>
          </button>
        </div>
      )}

      {/* Versions Timeline Cards */}
      {!loading && versions.length > 0 && (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-[#283046]">
          {versions.map((ver, idx) => {
            const m = ver.metrics || {};
            const isLatest = idx === 0;

            const totalTasks = m.total_tasks ?? m.totalTasks ?? (ver.snapshot_data?.tasks?.length || 0);
            const totalReqs = m.total_requirements ?? m.totalRequirements ?? (ver.snapshot_data?.requirements?.length || 0);
            const frCount = m.fr_count ?? m.functionalCount ?? 0;
            const nfrCount = m.nfr_count ?? m.nonFunctionalCount ?? 0;
            const totalDeps = m.total_dependencies ?? m.dependenciesCount ?? (ver.snapshot_data?.dependencies?.length || 0);
            const totalMembers = m.total_members ?? m.membersCount ?? (ver.snapshot_data?.members?.length || 1);
            const completionRate = m.completion_rate ?? m.progressPercentage ?? 0;

            return (
              <div
                key={ver.id}
                className="relative bg-[#181d28] border border-[#283046] hover:border-purple-500/40 rounded-xl p-5 shadow-md transition-all group"
              >
                {/* Timeline node */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-5 w-3 h-3 rounded-full border-2 transform -translate-x-1/2 ${
                    isLatest
                      ? 'bg-purple-500 border-[#181d28] ring-4 ring-purple-500/20'
                      : 'bg-[#283046] border-[#181d28]'
                  }`}
                />

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Version Meta */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-purple-600 text-white shadow-xs">
                        {ver.version_tag}
                      </span>
                      {isLatest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Latest Baseline
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-[#dfe1e6]">
                        {ver.title || `Snapshot ${ver.version_tag}`}
                      </h3>
                    </div>

                    {ver.description && (
                      <p className="text-xs text-[#9fadbc] max-w-3xl leading-relaxed whitespace-pre-wrap">
                        {ver.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-[#738496] pt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        <span>{formatDate(ver.created_at)}</span>
                      </span>
                      {ver.created_by && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          <span>{t('versionHistory.author')}: {ver.created_by}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    <button
                      onClick={() => handleInspect(ver)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202738] hover:bg-[#28324a] text-[#dfe1e6] text-xs font-semibold rounded-lg border border-[#313c57] transition-colors cursor-pointer"
                    >
                      <Eye size={13} className="text-sky-400" />
                      <span>{t('versionHistory.inspectBtn')}</span>
                    </button>

                    <button
                      onClick={() => handleOpenRestore(ver)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-semibold rounded-lg border border-purple-500/30 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={13} className="text-purple-400" />
                      <span>{t('versionHistory.restoreBtn')}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteSnapshot(ver)}
                      className="p-1.5 text-[#8c9bab] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title={t('versionHistory.deleteBtn')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Metrics Bar */}
                <div className="mt-4 pt-3.5 border-t border-[#22273b] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                  <div className="bg-[#1b2030] p-2.5 rounded-lg border border-[#283046]">
                    <div className="text-[10px] uppercase font-semibold text-[#738496] mb-0.5 flex items-center gap-1">
                      <ListTodo size={11} className="text-sky-400" />
                      <span>{t('versionHistory.tasksCount')}</span>
                    </div>
                    <div className="text-sm font-bold text-[#dfe1e6]">
                      {totalTasks}
                    </div>
                  </div>

                  <div className="bg-[#1b2030] p-2.5 rounded-lg border border-[#283046]">
                    <div className="text-[10px] uppercase font-semibold text-[#738496] mb-0.5 flex items-center gap-1">
                      <Layers size={11} className="text-indigo-400" />
                      <span>{t('versionHistory.requirementsCount')}</span>
                    </div>
                    <div className="text-sm font-bold text-[#dfe1e6]">
                      {totalReqs}
                      {(frCount > 0 || nfrCount > 0) && (
                        <span className="text-[10px] text-[#738496] font-normal ml-1">
                          ({frCount} FR / {nfrCount} NFR)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#1b2030] p-2.5 rounded-lg border border-[#283046]">
                    <div className="text-[10px] uppercase font-semibold text-[#738496] mb-0.5 flex items-center gap-1">
                      <Network size={11} className="text-amber-400" />
                      <span>{t('versionHistory.dependenciesCount')}</span>
                    </div>
                    <div className="text-sm font-bold text-[#dfe1e6]">
                      {totalDeps}
                    </div>
                  </div>

                  <div className="bg-[#1b2030] p-2.5 rounded-lg border border-[#283046]">
                    <div className="text-[10px] uppercase font-semibold text-[#738496] mb-0.5 flex items-center gap-1">
                      <Users size={11} className="text-emerald-400" />
                      <span>{t('versionHistory.membersCount')}</span>
                    </div>
                    <div className="text-sm font-bold text-[#dfe1e6]">
                      {totalMembers}
                    </div>
                  </div>

                  <div className="bg-[#1b2030] p-2.5 rounded-lg border border-[#283046]">
                    <div className="text-[10px] uppercase font-semibold text-[#738496] mb-0.5 flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-teal-400" />
                      <span>{t('versionHistory.completionRate')}</span>
                    </div>
                    <div className="text-sm font-bold text-[#dfe1e6]">
                      {completionRate}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Snapshot Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="bg-[#181d28] border border-[#2e374f] rounded-xl max-w-lg w-full shadow-2xl p-6 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#22273b]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <GitBranch size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#dfe1e6]">{t('versionHistory.createBtn')}</h3>
                  <p className="text-xs text-[#8c9bab]">{t('versionHistory.tagHelp')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-[#e5493a]/15 border border-[#e5493a]/30 rounded-lg text-xs text-[#f87168] flex items-center gap-2">
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSnapshot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
                  {t('versionHistory.snapshotTag')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder={t('versionHistory.tagPlaceholder')}
                  required
                  className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
                  {t('versionHistory.snapshotTitle')}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('versionHistory.titlePlaceholder')}
                  className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
                  {t('versionHistory.snapshotDesc')}
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t('versionHistory.descPlaceholder')}
                  className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>

              <div className="p-3 bg-[#1b2030] rounded-lg border border-[#283046] text-xs text-[#8c9bab] flex items-start gap-2">
                <Info size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <span>
                  This snapshot captures the live project state, all requirements & RETM matrix, tasks, dependencies, and KPI completion rates as an immutable baseline.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#22273b]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded-lg transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-lg transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <GitBranch size={14} />
                  <span>{createSubmitting ? t('versionHistory.submitting') : t('versionHistory.createBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Snapshot Modal */}
      {inspectVersion && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setInspectVersion(null)}
        >
          <div
            className="bg-[#181d28] border border-[#2e374f] rounded-xl max-w-4xl w-full shadow-2xl p-6 select-none max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#22273b] shrink-0">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-purple-600 text-white shadow-xs">
                  {inspectVersion.version_tag}
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#dfe1e6]">
                    {inspectVersion.title || `Snapshot ${inspectVersion.version_tag}`}
                  </h3>
                  <p className="text-xs text-[#8c9bab]">
                    {t('versionHistory.inspectModalSubtitle', { tag: inspectVersion.version_tag })} • {formatDate(inspectVersion.created_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectVersion(null)}
                className="p-1 text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-6 pr-1 grow text-xs">
              {inspectVersion.description && (
                <div className="p-3 bg-[#1b2030] border border-[#283046] rounded-lg text-[#c8d1dc]">
                  <span className="text-[10px] uppercase font-bold text-[#738496] block mb-1">
                    Release Notes & Rationale
                  </span>
                  <p className="whitespace-pre-wrap">{inspectVersion.description}</p>
                </div>
              )}

              {/* Requirements in Snapshot */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#9fadbc] mb-2 flex items-center gap-1.5">
                  <Layers size={13} className="text-indigo-400" />
                  <span>Requirements & RETM Matrix ({inspectVersion.snapshot_data?.requirements?.length || 0})</span>
                </h4>
                <div className="border border-[#283046] rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1b2030] text-[#738496] font-semibold border-b border-[#283046]">
                      <tr>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#22273b]">
                      {(inspectVersion.snapshot_data?.requirements || []).map((req) => (
                        <tr key={req.id} className="hover:bg-[#202738]/50">
                          <td className="py-2 px-3 font-mono font-bold text-sky-400">{req.code}</td>
                          <td className="py-2 px-3 text-[#dfe1e6]">{req.title}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.type === 'FUNCTIONAL' ? 'bg-sky-500/20 text-sky-300' : 'bg-purple-500/20 text-purple-300'
                            }`}>
                              {req.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#8c9bab]">{req.category}</td>
                          <td className="py-2 px-3 text-[#8c9bab]">{req.status}</td>
                        </tr>
                      ))}
                      {(!inspectVersion.snapshot_data?.requirements || inspectVersion.snapshot_data.requirements.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-[#738496]">No requirements recorded in this snapshot.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tasks in Snapshot */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#9fadbc] mb-2 flex items-center gap-1.5">
                  <ListTodo size={13} className="text-sky-400" />
                  <span>Tasks ({inspectVersion.snapshot_data?.tasks?.length || 0})</span>
                </h4>
                <div className="border border-[#283046] rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1b2030] text-[#738496] font-semibold border-b border-[#283046]">
                      <tr>
                        <th className="py-2 px-3">Key</th>
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#22273b]">
                      {(inspectVersion.snapshot_data?.tasks || []).map((t) => (
                        <tr key={t.id} className="hover:bg-[#202738]/50">
                          <td className="py-2 px-3 font-mono font-semibold text-[#8c9bab]">{t.key}</td>
                          <td className="py-2 px-3 text-[#dfe1e6]">{t.title}</td>
                          <td className="py-2 px-3 text-[#8c9bab]">{t.status}</td>
                          <td className="py-2 px-3 text-[#8c9bab]">{t.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-[#22273b] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInspectVersion(null);
                  handleOpenRestore(inspectVersion);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-semibold rounded-lg border border-purple-500/30 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>{t('versionHistory.restoreBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectVersion(null)}
                className="px-4 py-1.5 bg-[#202738] hover:bg-[#28324a] text-[#dfe1e6] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore / Branch Modal */}
      {restoreModalVersion && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setRestoreModalVersion(null)}
        >
          <div
            className="bg-[#181d28] border border-[#2e374f] rounded-xl max-w-lg w-full shadow-2xl p-6 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#22273b]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#dfe1e6]">{t('versionHistory.restoreModalTitle')}</h3>
                  <p className="text-xs text-[#8c9bab]">
                    Using snapshot <span className="font-mono text-purple-300">{restoreModalVersion.version_tag}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalVersion(null)}
                className="p-1 text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {restoreError && (
              <div className="mb-4 p-3 bg-[#e5493a]/15 border border-[#e5493a]/30 rounded-lg text-xs text-[#f87168] flex items-center gap-2">
                <span>⚠️</span>
                <span>{restoreError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteRestore} className="space-y-4">
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    restoreMode === 'branch'
                      ? 'bg-purple-500/15 border-purple-500 text-[#dfe1e6]'
                      : 'bg-[#1b2030] border-[#283046] text-[#8c9bab]'
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    value="branch"
                    checked={restoreMode === 'branch'}
                    onChange={() => setRestoreMode('branch')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-bold text-xs text-[#dfe1e6] block">
                      {t('versionHistory.restoreAsNewProject')}
                    </span>
                    <span className="text-[11px] text-[#8c9bab]">
                      Safely clones this snapshot into a new standalone project without affecting current active work.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    restoreMode === 'overwrite'
                      ? 'bg-amber-500/15 border-amber-500 text-[#dfe1e6]'
                      : 'bg-[#1b2030] border-[#283046] text-[#8c9bab]'
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    value="overwrite"
                    checked={restoreMode === 'overwrite'}
                    onChange={() => setRestoreMode('overwrite')}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-bold text-xs text-amber-300 block">
                      {t('versionHistory.restoreOverwrite')}
                    </span>
                    <span className="text-[11px] text-[#8c9bab]">
                      Rolls back current project tasks and requirements to this snapshot checkpoint.
                    </span>
                  </div>
                </label>
              </div>

              {restoreMode === 'branch' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
                      {t('versionHistory.newProjectName')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] text-sm focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
                      {t('versionHistory.newProjectKey')}
                    </label>
                    <input
                      type="text"
                      value={branchKey}
                      onChange={(e) => setBranchKey(e.target.value.toUpperCase())}
                      placeholder="Auto-derived if empty"
                      maxLength={10}
                      className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] text-sm uppercase font-mono focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#22273b]">
                <button
                  type="button"
                  onClick={() => setRestoreModalVersion(null)}
                  disabled={restoreSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded-lg transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={restoreSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>{restoreSubmitting ? t('versionHistory.submitting') : t('versionHistory.restoreBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

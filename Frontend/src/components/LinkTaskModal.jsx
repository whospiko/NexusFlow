import React, { useState } from 'react';
import {
  X,
  Link2,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Info,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export function LinkTaskModal({
  isOpen,
  onClose,
  projectId,
  issues = [],
  dependencies = [],
  onDependencyChanged,
}) {
  const { t } = useLanguage();
  const [predecessorId, setPredecessorId] = useState(issues[0]?.id ? String(issues[0].id) : '');
  const [successorId, setSuccessorId] = useState(
    issues[1]?.id ? String(issues[1].id) : issues[0]?.id ? String(issues[0].id) : ''
  );
  const [depType, setDepType] = useState('FS');
  const [lagDays, setLagDays] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const predIssue = issues.find((i) => String(i.id) === String(predecessorId));
  const succIssue = issues.find((i) => String(i.id) === String(successorId));

  const depTypesList = [
    {
      type: 'FS',
      name: t('depTypes.FS.name'),
      short: 'FS',
      tagColor: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
      description: t('depTypes.FS.desc'),
    },
    {
      type: 'SS',
      name: t('depTypes.SS.name'),
      short: 'SS',
      tagColor: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      description: t('depTypes.SS.desc'),
    },
    {
      type: 'FF',
      name: t('depTypes.FF.name'),
      short: 'FF',
      tagColor: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
      description: t('depTypes.FF.desc'),
    },
    {
      type: 'SF',
      name: t('depTypes.SF.name'),
      short: 'SF',
      tagColor: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      description: t('depTypes.SF.desc'),
    },
  ];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!predecessorId || !successorId) {
      setErrorMsg('Please select both a predecessor and a successor issue.');
      return;
    }
    if (predecessorId === successorId) {
      setErrorMsg('Cannot link a task to itself.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.createDependency({
        project_id: projectId,
        predecessor_id: parseInt(predecessorId, 10),
        successor_id: parseInt(successorId, 10),
        dependency_type: depType,
        lag_days: parseInt(lagDays, 10) || 0,
      });

      setSuccessMsg(t('gantt.linkSuccess', { pred: `ALPHA-${predecessorId}`, succ: `ALPHA-${successorId}`, type: depType }));
      if (onDependencyChanged) onDependencyChanged();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create dependency link.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (depId) => {
    if (!window.confirm('Are you sure you want to remove this task dependency?')) return;
    setDeletingId(depId);
    setErrorMsg('');
    try {
      await api.deleteDependency(depId);
      if (onDependencyChanged) onDependencyChanged();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to remove dependency.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="bg-[#161a23] border border-[#262c3f] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#22273b] flex items-center justify-between bg-[#11151f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-[#579dff]">
              <Link2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#dfe1e6]">{t('modals.linkTasksTitle')}</h2>
              <p className="text-[11px] text-[#8c9bab]">
                Precedence Diagramming Method (FS, SS, FF, SF)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1e2433] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-start gap-2 animate-fadeIn">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-start gap-2 animate-fadeIn">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form to Create New Link */}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Predecessor (A) */}
              <div>
                <label className="block text-[11px] font-bold text-[#dfe1e6] uppercase tracking-wider mb-1.5">
                  1. {t('modals.predecessorTask')}
                </label>
                <select
                  value={predecessorId}
                  onChange={(e) => setPredecessorId(e.target.value)}
                  className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-xl px-3 py-2 outline-none focus:border-[#579dff] cursor-pointer"
                >
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      ALPHA-{i.id}: {i.title}
                    </option>
                  ))}
                </select>
                {predIssue && (
                  <div className="mt-1 text-[10px] text-[#8c9bab] flex items-center gap-2">
                    <span>{predIssue.start_date || 'N/A'} ➔ {predIssue.due_date || 'N/A'}</span>
                  </div>
                )}
              </div>

              {/* Successor (B) */}
              <div>
                <label className="block text-[11px] font-bold text-[#dfe1e6] uppercase tracking-wider mb-1.5">
                  2. {t('modals.successorTask')}
                </label>
                <select
                  value={successorId}
                  onChange={(e) => setSuccessorId(e.target.value)}
                  className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-xl px-3 py-2 outline-none focus:border-[#579dff] cursor-pointer"
                >
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      ALPHA-{i.id}: {i.title}
                    </option>
                  ))}
                </select>
                {succIssue && (
                  <div className="mt-1 text-[10px] text-[#8c9bab] flex items-center gap-2">
                    <span>{succIssue.start_date || 'N/A'} ➔ {succIssue.due_date || 'N/A'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dependency Type Selection Grid */}
            <div>
              <label className="block text-[11px] font-bold text-[#dfe1e6] uppercase tracking-wider mb-2">
                3. {t('modals.dependencyType')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {depTypesList.map((dt) => {
                  const isSelected = depType === dt.type;
                  return (
                    <div
                      key={dt.type}
                      onClick={() => setDepType(dt.type)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#579dff] bg-[#579dff]/10 shadow-sm'
                          : 'border-[#262c3f] bg-[#0c1017] hover:border-[#3b4460]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-[#dfe1e6]">{dt.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${dt.tagColor}`}>
                          {dt.short}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8c9bab] leading-relaxed">
                        {dt.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lag / Lead Days */}
            <div>
              <label className="block text-[11px] font-bold text-[#dfe1e6] uppercase tracking-wider mb-1.5">
                4. {t('modals.lagDays')}
              </label>
              <input
                type="number"
                value={lagDays}
                onChange={(e) => setLagDays(e.target.value)}
                className="w-32 bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-xl px-3 py-1.5 outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0c66e4] hover:bg-[#0052cc] text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('modals.creatingLink') : t('modals.createLinkBtn')}
            </button>
          </form>

          {/* Existing Links List */}
          <div className="pt-4 border-t border-[#22273b]">
            <h3 className="text-[11px] font-bold text-[#dfe1e6] uppercase tracking-wider mb-3">
              {t('modals.existingLinks')} ({dependencies.length})
            </h3>

            {dependencies.length === 0 ? (
              <p className="text-[#8c9bab] text-xs italic">{t('modals.noLinks')}</p>
            ) : (
              <div className="space-y-2">
                {dependencies.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0c1017] border border-[#22273b] hover:border-[#2e374f] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[#579dff]">
                        ALPHA-{d.predecessor_id}
                      </span>
                      <ArrowRight size={12} className="text-[#8c9bab]" />
                      <span className="font-mono text-[11px] font-semibold text-[#579dff]">
                        ALPHA-{d.successor_id}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400">
                        {d.dependency_type}
                      </span>
                      {d.lag_days !== 0 && (
                        <span className="text-[10px] text-[#8c9bab] font-mono">
                          ({d.lag_days > 0 ? `+${d.lag_days}` : d.lag_days}d)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === d.id}
                      onClick={() => handleDelete(d.id)}
                      className="p-1 rounded text-[#8c9bab] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#22273b] bg-[#11151f] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1e2433] hover:bg-[#283044] text-[#dfe1e6] text-xs font-semibold transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

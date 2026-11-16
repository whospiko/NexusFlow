import React, { useState } from 'react';
import { X, Copy, CheckSquare, Layers, GitBranch, Users, Network, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../services/api.js';

export function DuplicateProjectModal({ isOpen, onClose, project, onDuplicated }) {
  const { t } = useLanguage();

  const [name, setName] = useState(project ? `${project.name} (Copy)` : '');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState(project?.description || '');
  const [cloneTasks, setCloneTasks] = useState(true);
  const [cloneRequirements, setCloneRequirements] = useState(true);
  const [cloneMembers, setCloneMembers] = useState(true);
  const [cloneDependencies, setCloneDependencies] = useState(true);
  const [resetStatus, setResetStatus] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync state if project prop updates
  React.useEffect(() => {
    if (project) {
      setName(`${project.name} (Copy)`);
      setDescription(project.description || '');
      setKey('');
      setError(null);
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('duplicateModal.projectName') + ' ' + t('common.required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        key: key.trim().toUpperCase() || undefined,
        description: description.trim(),
        cloneTasks,
        cloneRequirements,
        cloneMembers,
        cloneDependencies,
        resetStatus,
      };

      const result = await api.duplicateProject(project.id, payload);
      if (onDuplicated) {
        onDuplicated(result.project);
      }
      onClose();
    } catch (err) {
      setError(err.data?.message || err.message || t('duplicateModal.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#181d28] border border-[#2e374f] rounded-xl max-w-xl w-full shadow-2xl p-6 select-none max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#22273b]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Copy size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#dfe1e6]">{t('duplicateModal.title')}</h3>
              <p className="text-xs text-[#8c9bab]">{t('duplicateModal.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#e5493a]/15 border border-[#e5493a]/30 rounded-lg text-xs text-[#f87168] flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
              {t('duplicateModal.projectName')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('duplicateModal.projectNamePlaceholder')}
              required
              className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] placeholder-[#626f86] text-sm focus:outline-none focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
                {t('duplicateModal.projectKey')}
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder={t('duplicateModal.projectKeyPlaceholder')}
                maxLength={10}
                className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] placeholder-[#626f86] text-sm focus:outline-none focus:border-[#579dff] uppercase font-mono transition-all"
              />
              <span className="text-[11px] text-[#738496] mt-0.5 block">Auto-derived if left blank</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
                Source Project
              </label>
              <div className="px-3 py-2 bg-[#1b2030] border border-[#283046] rounded-lg text-xs text-[#8c9bab] flex items-center gap-1.5 truncate">
                <span className="font-semibold text-sky-400 font-mono">[{project.key}]</span>
                <span className="truncate">{project.name}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9fadbc] mb-1.5">
              {t('duplicateModal.description')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('duplicateModal.descriptionPlaceholder')}
              className="w-full px-3 py-2 bg-[#22273b] border border-[#2e374f] rounded-lg text-[#dfe1e6] placeholder-[#626f86] text-xs focus:outline-none focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] transition-all"
            />
          </div>

          {/* Options Checklist */}
          <div className="pt-2 border-t border-[#22273b]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9fadbc] block mb-2.5">
              Template Cloning Scope
            </span>
            <div className="space-y-2 bg-[#1b2030]/60 p-3 rounded-lg border border-[#283046]">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#dfe1e6]">
                <input
                  type="checkbox"
                  checked={cloneRequirements}
                  onChange={(e) => setCloneRequirements(e.target.checked)}
                  className="rounded border-[#3b4764] bg-[#22273b] text-indigo-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                />
                <Layers size={14} className="text-indigo-400 shrink-0" />
                <span>{t('duplicateModal.cloneRequirements')}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#dfe1e6]">
                <input
                  type="checkbox"
                  checked={cloneTasks}
                  onChange={(e) => setCloneTasks(e.target.checked)}
                  className="rounded border-[#3b4764] bg-[#22273b] text-indigo-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                />
                <CheckSquare size={14} className="text-sky-400 shrink-0" />
                <span>{t('duplicateModal.cloneTasks')}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#dfe1e6]">
                <input
                  type="checkbox"
                  checked={cloneDependencies}
                  onChange={(e) => setCloneDependencies(e.target.checked)}
                  disabled={!cloneTasks}
                  className="rounded border-[#3b4764] bg-[#22273b] text-indigo-500 focus:ring-0 focus:ring-offset-0 h-4 w-4 disabled:opacity-40"
                />
                <Network size={14} className="text-amber-400 shrink-0" />
                <span className={!cloneTasks ? 'opacity-40' : ''}>{t('duplicateModal.cloneDependencies')}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#dfe1e6]">
                <input
                  type="checkbox"
                  checked={cloneMembers}
                  onChange={(e) => setCloneMembers(e.target.checked)}
                  className="rounded border-[#3b4764] bg-[#22273b] text-indigo-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                />
                <Users size={14} className="text-emerald-400 shrink-0" />
                <span>{t('duplicateModal.cloneMembers')}</span>
              </label>

              <div className="pt-2 mt-1 border-t border-[#22273b]">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#dfe1e6]">
                  <input
                    type="checkbox"
                    checked={resetStatus}
                    onChange={(e) => setResetStatus(e.target.checked)}
                    disabled={!cloneTasks}
                    className="rounded border-[#3b4764] bg-[#22273b] text-indigo-500 focus:ring-0 focus:ring-offset-0 h-4 w-4 disabled:opacity-40"
                  />
                  <RefreshCw size={14} className="text-purple-400 shrink-0" />
                  <span className={`font-medium ${!cloneTasks ? 'opacity-40' : 'text-purple-300'}`}>
                    {t('duplicateModal.resetStatus')}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#22273b]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded-lg transition-colors cursor-pointer"
            >
              {t('duplicateModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg transition-colors shadow-md disabled:opacity-50 cursor-pointer"
            >
              <Copy size={14} />
              <span>{loading ? t('duplicateModal.submitting') : t('duplicateModal.submitBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import { X, FolderEdit } from 'lucide-react';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export function EditProjectModal({ isOpen, onClose, project, onProjectUpdated }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setError(null);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('modals.projectName') + ' ' + t('common.required'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
      });

      if (onProjectUpdated) {
        onProjectUpdated(res.data);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update project settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#181d28] border border-[#2e374f] rounded-xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#22273b] flex items-center justify-between bg-[#161a23]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <FolderEdit size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t('modals.editProjectTitle')}</h3>
              <p className="text-[11px] text-[#8c9bab]">{t('projects.pageDesc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8c9bab] hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
              {t('modals.projectName')} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('modals.projectNamePlaceholder')}
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none placeholder-[#626f86] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
              {t('modals.projectDesc')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('modals.projectDescPlaceholder')}
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none placeholder-[#626f86] transition-all resize-y"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#121622] hover:bg-[#1f2638] text-[#dfe1e6] text-xs font-semibold rounded-lg border border-[#2e374f] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#0052cc] hover:bg-[#0747a6] text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('common.loading') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

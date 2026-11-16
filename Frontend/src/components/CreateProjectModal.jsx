import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

export function CreateProjectModal({ isOpen, onClose, onProjectCreated }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('modals.projectName') + ' ' + t('common.required'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onProjectCreated({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err.data?.message || err.message);
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
        className="bg-[#181d28] border border-[#2e374f] rounded-lg max-w-lg w-full shadow-2xl p-6 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#22273b]">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-[#0c66e4]/15 border border-[#0c66e4]/30 text-[#579dff]">
              <FolderPlus size={18} />
            </div>
            <h3 className="text-base font-bold text-[#dfe1e6]">{t('modals.createProjectTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
              {t('modals.projectName')} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder={t('modals.projectNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none placeholder-[#626f86] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
              {t('modals.projectDesc')}
            </label>
            <textarea
              rows={3}
              placeholder={t('modals.projectDescPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none placeholder-[#626f86] transition-all resize-y"
            />
          </div>

          <div className="pt-4 border-t border-[#22273b] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-[#22273b] hover:bg-[#2c334d] text-xs font-semibold text-[#dfe1e6] border border-[#333c56] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Bug, Tag, User } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export function CreateIssueModal({ isOpen, onClose, onIssueCreated, projectId }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    creator: user?.name || 'Piko',
    assignee: '',
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (user?.name) {
        setFormData((prev) => ({ ...prev, creator: user.name }));
      }
      api.getTags()
        .then((res) => setAvailableTags(res.data || []))
        .catch(() => setAvailableTags([]));

      if (projectId) {
        api.getProjectMembers(projectId)
          .then((res) => setProjectMembers(res.data || []))
          .catch(() => setProjectMembers([]));
      }
    }
  }, [isOpen, projectId, user]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError(t('modals.issueSummary') + ' ' + t('common.required'));
      return;
    }
    if (!formData.creator.trim()) {
      setError(t('issueDetail.reporter') + ' ' + t('common.required'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onIssueCreated({
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        creator: formData.creator.trim(),
        assignee: formData.assignee.trim() || null,
        tagIds: selectedTagIds,
      });
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        creator: user?.name || 'Piko',
        assignee: '',
      });
      setSelectedTagIds([]);
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
        className="bg-[#181d28] border border-[#2e374f] rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#22273b] flex items-center justify-between bg-[#161a23]">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <Bug size={16} />
            </div>
            <h3 className="text-base font-bold text-[#dfe1e6]">{t('modals.createIssueTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Issue Type Chip */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e2333] border border-[#2e374f] text-[#8c9bab]">
              <span className="text-[#626f86]">{t('modals.issueType')}:</span>
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <Bug size={12} /> Bug
              </span>
            </div>
          </div>

          {/* Summary / Title */}
          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
              {t('modals.issueSummary')} <span className="text-rose-400">*</span>
            </label>
            <input
              name="title"
              type="text"
              placeholder={t('modals.issueSummaryPlaceholder')}
              value={formData.title}
              onChange={handleChange}
              autoFocus
              required
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none placeholder-[#626f86] transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
              {t('modals.issueDesc')}
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder={t('modals.issueDescPlaceholder')}
              value={formData.description}
              onChange={handleChange}
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none placeholder-[#626f86] transition-all resize-y"
            />
          </div>

          {/* Priority & Assignee Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                {t('issueDetail.priority')}
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none transition-all cursor-pointer"
              >
                <option value="low">{t('priority.low')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="critical">{t('priority.critical')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
                {t('issueDetail.assignee')}
              </label>
              {projectMembers.length > 0 ? (
                <select
                  name="assignee"
                  value={formData.assignee}
                  onChange={handleChange}
                  className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none transition-all cursor-pointer"
                >
                  <option value="">{t('common.unassigned')}</option>
                  {projectMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="assignee"
                  type="text"
                  placeholder="e.g. Alex V."
                  value={formData.assignee}
                  onChange={handleChange}
                  className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none placeholder-[#626f86] transition-all"
                />
              )}
            </div>
          </div>

          {/* Reporter */}
          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1">
              {t('issueDetail.reporter')} <span className="text-rose-400">*</span>
            </label>
            <input
              name="creator"
              type="text"
              placeholder="e.g. Piko"
              value={formData.creator}
              onChange={handleChange}
              required
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none placeholder-[#626f86] transition-all"
            />
          </div>

          {/* Labels / Tags Multi-Picker */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5 flex items-center gap-1.5">
                <Tag size={12} className="text-[#579dff]" />
                <span>{t('issueDetail.tags')}</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tItem) => {
                  const isSelected = selectedTagIds.includes(tItem.id);
                  return (
                    <button
                      key={tItem.id}
                      type="button"
                      onClick={() => toggleTag(tItem.id)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                        isSelected
                          ? 'border-transparent text-white'
                          : 'bg-[#121622] border-[#2e374f] text-[#8c9bab] hover:text-[#dfe1e6] hover:border-[#3b4460]'
                      }`}
                      style={{
                        backgroundColor: isSelected ? tItem.color : undefined,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{
                          backgroundColor: isSelected ? '#ffffff' : tItem.color,
                        }}
                      />
                      <span>{tItem.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modal Footer */}
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
              {loading ? t('common.loading') : t('projectDetail.createIssue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

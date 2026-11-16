import React, { useState, useEffect } from 'react';
import { X, Edit3, Bug, User, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export function EditIssueModal({ isOpen, onClose, issue, onIssueUpdated, projectId }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [progress, setProgress] = useState(0);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (issue && isOpen) {
      setTitle(issue.title || '');
      setDescription(issue.description || '');
      setPriority(issue.priority || 'medium');
      setAssignee(issue.assignee || '');
      setStartDate(issue.start_date || '');
      setDueDate(issue.due_date || '');
      setEstimatedHours(issue.estimated_hours || 8);
      setProgress(issue.progress || 0);
      setError(null);

      const pid = projectId || issue.project_id;
      if (pid) {
        api.getProjectMembers(pid)
          .then((res) => setProjectMembers(res.data || []))
          .catch(() => setProjectMembers([]));
      }
    }
  }, [issue, isOpen, projectId]);

  if (!isOpen || !issue) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('modals.issueSummary') + ' ' + t('common.required'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.updateIssue(issue.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority: priority.toLowerCase(),
        assignee: assignee ? assignee.trim() : null,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        progress: parseInt(progress, 10),
        actor: user?.name || 'User',
      });

      if (onIssueUpdated) {
        onIssueUpdated(res.data);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update issue');
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
        className="bg-[#181d28] border border-[#2e374f] rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#22273b] flex items-center justify-between bg-[#161a23]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Edit3 size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{t('modals.editIssueTitle')}</h3>
                <span className="font-mono text-xs text-[#579dff] bg-[#0c66e4]/20 px-1.5 py-0.5 rounded border border-[#0c66e4]/30">
                  ALPHA-{issue.id}
                </span>
              </div>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
              {t('modals.issueSummary')} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('modals.issueSummaryPlaceholder')}
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none placeholder-[#626f86] transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
              {t('modals.issueDesc')}
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('modals.issueDescPlaceholder')}
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none placeholder-[#626f86] transition-all resize-y"
            />
          </div>

          {/* Priority & Assignee Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
                {t('issueDetail.priority')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none transition-all cursor-pointer"
              >
                <option value="low">{t('priority.low')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="critical">{t('priority.critical')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
                {t('issueDetail.assignee')}
              </label>
              {projectMembers.length > 0 ? (
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none transition-all cursor-pointer"
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
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="e.g. Alex V."
                  className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none placeholder-[#626f86] transition-all"
                />
              )}
            </div>
          </div>

          {/* Timeline & Schedule Fields */}
          <div className="pt-2 border-t border-[#22273b] space-y-3">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#9fadbc]">
              {t('projectDetail.ganttTimeline')}
            </span>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8c9bab] mb-1">
                  {t('gantt.startColumn')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8c9bab] mb-1">
                  {t('issueDetail.dueDate')}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8c9bab] mb-1">
                  {t('modals.originalEstHours')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2 outline-none font-mono"
                />
              </div>
            </div>

            {/* Progress Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[#8c9bab]">
                  {t('gantt.progressColumn')}
                </label>
                <span className="text-xs font-mono font-bold text-[#579dff]">{progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="w-full h-1.5 bg-[#22273b] rounded-lg appearance-none cursor-pointer accent-[#0c66e4]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex justify-end gap-2.5 border-t border-[#22273b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#121622] hover:bg-[#1f2638] text-[#dfe1e6] text-xs font-semibold rounded-lg border border-[#2e374f] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-4 py-2 bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? t('common.loading') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditIssueModal;

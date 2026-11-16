import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export function LogWorkModal({ isOpen, onClose, issueId, projectId, onWorkLogged, initialIssue }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedIssueId, setSelectedIssueId] = useState(issueId || '');
  const [projectIssues, setProjectIssues] = useState([]);
  const [hoursSpent, setHoursSpent] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (issueId) {
      setSelectedIssueId(issueId);
    }
    if (initialIssue?.progress !== undefined) {
      setProgress(initialIssue.progress);
    }
  }, [issueId, initialIssue]);

  useEffect(() => {
    if (projectId && !issueId && isOpen) {
      api.getIssues(projectId)
        .then((res) => setProjectIssues(res.data || []))
        .catch(() => setProjectIssues([]));
    }
  }, [projectId, issueId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hrs = parseFloat(hoursSpent);
    if (!hrs || hrs <= 0) {
      setError('Please enter a valid positive number of hours (e.g. 2.5)');
      return;
    }
    if (!selectedIssueId) {
      setError(t('modals.issueSummary') + ' ' + t('common.required'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.createTimeLog(selectedIssueId, {
        hours_spent: hrs,
        log_date: logDate,
        description: description.trim() || 'Work logged',
        author: user?.name || 'User',
        new_progress: progress !== '' ? parseInt(progress, 10) : undefined,
      });

      if (onWorkLogged) {
        onWorkLogged(res.data);
      }
      onClose();
      setHoursSpent('');
      setDescription('');
    } catch (err) {
      setError(err.message || 'Failed to log work hours');
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
        className="bg-[#181d28] border border-[#2e374f] rounded-xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#22273b] flex items-center justify-between bg-[#161a23]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Clock size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t('modals.logWorkTitle')}</h3>
              <p className="text-[11px] text-[#8c9bab]">{t('timesheet.desc')}</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Issue Selector if not pre-bound */}
          {!issueId && projectIssues.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
                {t('modals.issueSummary')} <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={selectedIssueId}
                onChange={(e) => setSelectedIssueId(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none cursor-pointer"
              >
                <option value="" disabled>{t('common.selectOption')}</option>
                {projectIssues.map((i) => (
                  <option key={i.id} value={i.id}>
                    ALPHA-{i.id}: {i.title} ({t(`status.${i.status}`)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Time Spent (Hours) */}
            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
                {t('modals.timeSpentHours')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                required
                placeholder={t('modals.timeSpentPlaceholder')}
                value={hoursSpent}
                onChange={(e) => setHoursSpent(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none font-mono"
              />
            </div>

            {/* Date Worked */}
            <div>
              <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
                {t('modals.dateWorked')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none"
              />
            </div>
          </div>

          {/* Progress Slider / Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#8c9bab]">
                {t('modals.newProgressPercent')}
              </label>
              <span className="text-xs font-mono font-bold text-[#579dff]">
                {progress !== '' ? `${progress}%` : '—'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress !== '' ? progress : 0}
              onChange={(e) => setProgress(e.target.value)}
              className="w-full h-1.5 bg-[#22273b] rounded-lg appearance-none cursor-pointer accent-[#0c66e4]"
            />
            <div className="flex justify-between text-[10px] text-[#626f86] mt-1 font-mono">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Work Description */}
          <div>
            <label className="block text-xs font-semibold text-[#8c9bab] mb-1.5">
              {t('modals.workDesc')}
            </label>
            <textarea
              rows={3}
              placeholder={t('modals.workDescPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-lg p-2.5 outline-none resize-none placeholder-[#626f86]"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#22273b] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-[#1e2333] hover:bg-[#283044] text-[#8c9bab] hover:text-[#dfe1e6] text-xs font-semibold transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{loading ? t('common.loading') : t('issueDetail.logWork')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

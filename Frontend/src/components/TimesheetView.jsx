import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from './StatusBadge.jsx';
import { PriorityBadge } from './PriorityBadge.jsx';
import { LogWorkModal } from './LogWorkModal.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';

function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function TimesheetView({ projectId, issues = [] }) {
  const { t, language } = useLanguage();
  const [timesheetData, setTimesheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Week offset (0 = current week, -1 = last week, +1 = next week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Log Work Modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedIssueForLog, setSelectedIssueForLog] = useState(null);

  // Compute current week Monday & Sunday based on weekOffset
  const { startDate, endDate, dayHeaders } = React.useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + weekOffset * 7);
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(now.setDate(diffToMon));

    const headers = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      headers.push({ date: iso, dayName, dayNum });
    }

    const start = headers[0].date;
    const end = headers[6].date;
    return { startDate: start, endDate: end, dayHeaders: headers };
  }, [weekOffset, language]);

  const fetchTimesheets = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await api.getProjectTimesheets(projectId, { startDate, endDate });
      setTimesheetData(res);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load project timesheets');
    } finally {
      setLoading(false);
    }
  }, [projectId, startDate, endDate]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  const rows = timesheetData?.rows || [];
  const grandTotal = timesheetData?.grandTotalHours || 0;

  // Compute daily totals across all rows
  const dailyTotals = dayHeaders.map((dh) => {
    return rows.reduce((sum, r) => sum + (r.daily_hours[dh.date] || 0), 0);
  });

  const handleOpenLogModal = (issue = null) => {
    setSelectedIssueForLog(issue);
    setIsLogModalOpen(true);
  };

  return (
    <div className="bg-[#121622] border border-[#22273b] rounded-xl overflow-hidden shadow-xl select-none">
      {/* Timesheet Header Toolbar */}
      <div className="p-4 bg-[#161a23] border-b border-[#22273b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet size={16} />
            </div>
            <h2 className="text-sm font-bold text-[#dfe1e6]">{t('timesheet.title')}</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {grandTotal} {t('common.hrs')}
            </span>
          </div>
          <p className="text-xs text-[#8c9bab]">
            {t('timesheet.desc')}
          </p>
        </div>

        {/* Date Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Navigator */}
          <div className="flex items-center bg-[#0c1017] border border-[#2e374f] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 text-[#8c9bab] hover:text-white rounded hover:bg-[#1a202e] transition-colors cursor-pointer"
              title={t('timesheet.prevWeek')}
            >
              <ChevronLeft size={15} />
            </button>

            <span className="px-3 text-xs font-medium text-[#dfe1e6]">
              {dayHeaders[0].dayName} {dayHeaders[0].dayNum} — {dayHeaders[6].dayName} {dayHeaders[6].dayNum}
            </span>

            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1 text-[#8c9bab] hover:text-white rounded hover:bg-[#1a202e] transition-colors cursor-pointer"
              title={t('timesheet.nextWeek')}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[#1e2333] hover:bg-[#283044] text-[#8c9bab] hover:text-white transition-colors cursor-pointer"
            >
              {t('gantt.today')}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenLogModal(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Clock size={13} />
            <span>{t('timesheet.logWorkBtn')}</span>
          </button>
        </div>
      </div>

      {/* Database Error Banner */}
      {error && (
        <div className="m-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Timesheet Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#161a23] border-b border-[#22273b] text-[11px] font-bold uppercase tracking-wider text-[#9fadbc]">
              <th className="py-3 px-4 w-28">{t('projectDetail.tableKey')}</th>
              <th className="py-3 px-4 min-w-[200px]">{t('projectDetail.tableSummary')}</th>
              <th className="py-3 px-4 w-32">{t('timesheet.user')}</th>
              <th className="py-3 px-3 w-28">{t('projectDetail.tableStatus')}</th>
              {dayHeaders.map((dh) => {
                const isToday = dh.date === new Date().toISOString().split('T')[0];
                return (
                  <th
                    key={dh.date}
                    className={`py-3 px-2 text-center w-14 ${
                      isToday ? 'bg-blue-500/10 text-[#579dff] font-bold border-x border-blue-500/20' : ''
                    }`}
                  >
                    <div>{dh.dayName}</div>
                    <div className="font-mono text-[10px] text-[#8c9bab] font-normal">{dh.dayNum}</div>
                  </th>
                );
              })}
              <th className="py-3 px-3 text-right w-16">{t('timesheet.totalHours')}</th>
              <th className="py-3 px-3 text-center w-20">{t('gantt.progressColumn')}</th>
              <th className="py-3 px-3 text-center w-14">{t('projectDetail.tableActions')}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1e2436]">
            {loading && (
              <tr>
                <td colSpan={14} className="py-12 text-center text-[#8c9bab] text-xs">
                  <Clock size={20} className="animate-spin mx-auto mb-2 text-[#579dff]" />
                  <span>{t('common.loading')}</span>
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={14} className="py-12 text-center text-[#8c9bab] text-xs">
                  <Clock size={28} className="mx-auto mb-2 text-[#626f86]" />
                  <p className="font-semibold text-[#dfe1e6]">{t('timesheet.noEntries')}</p>
                  <p className="text-[11px] text-[#8c9bab] mt-1 mb-3">
                    {t('timesheet.desc')}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenLogModal(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>{t('timesheet.logWorkBtn')}</span>
                  </button>
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr
                  key={`${row.issue_id}-${row.author}`}
                  className="hover:bg-[#181d2c] transition-colors group"
                >
                  {/* Issue Key */}
                  <td className="py-3 px-4 font-mono text-[11px] font-semibold text-[#579dff]">
                    <Link to={`/issues/${row.issue_id}`} className="hover:underline">
                      ALPHA-{row.issue_id}
                    </Link>
                  </td>

                  {/* Task Title */}
                  <td className="py-3 px-4 font-medium text-[#dfe1e6] max-w-xs truncate">
                    <Link
                      to={`/issues/${row.issue_id}`}
                      className="hover:text-[#579dff] transition-colors"
                      title={row.issue_title}
                    >
                      {row.issue_title}
                    </Link>
                  </td>

                  {/* Member Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-xs text-[#dfe1e6]">
                      <div className="w-5 h-5 rounded-full bg-[#22273b] border border-[#2e374f] text-[9px] font-bold text-[#dfe1e6] flex items-center justify-center">
                        {getInitials(row.author)}
                      </div>
                      <span className="truncate">{row.author}</span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3">
                    <StatusBadge status={row.issue_status} />
                  </td>

                  {/* Day Columns */}
                  {dayHeaders.map((dh) => {
                    const hrs = row.daily_hours[dh.date];
                    const isToday = dh.date === new Date().toISOString().split('T')[0];
                    return (
                      <td
                        key={dh.date}
                        className={`py-3 px-2 text-center font-mono text-xs ${
                          isToday ? 'bg-blue-500/5 border-x border-blue-500/10' : ''
                        }`}
                      >
                        {hrs ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 font-semibold text-[11px]">
                            {hrs}h
                          </span>
                        ) : (
                          <span className="text-[#626f86]">-</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Row Total */}
                  <td className="py-3 px-3 text-right font-mono text-xs font-bold text-emerald-400">
                    {row.total_hours.toFixed(1)}h
                  </td>

                  {/* % Complete Progress */}
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex items-center gap-1 font-mono text-[11px] text-[#8c9bab]">
                      <span>{row.progress || 0}%</span>
                    </div>
                  </td>

                  {/* Quick Action */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenLogModal({ id: row.issue_id, title: row.issue_title, progress: row.progress })}
                      className="p-1 rounded text-[#8c9bab] hover:text-[#579dff] hover:bg-[#0c66e4]/15 transition-colors cursor-pointer"
                      title="Log more hours on this task"
                    >
                      <Plus size={13} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>

          {/* Grand Totals Summary Footer */}
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr className="bg-[#161a23] border-t-2 border-[#22273b] font-bold text-xs text-[#dfe1e6]">
                <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-[#8c9bab]">
                  {t('timesheet.weeklyTotal')}:
                </td>
                {dailyTotals.map((hrs, idx) => (
                  <td key={idx} className="py-3 px-2 text-center font-mono text-xs text-[#579dff]">
                    {hrs > 0 ? `${hrs.toFixed(1)}h` : '-'}
                  </td>
                ))}
                <td className="py-3 px-3 text-right font-mono text-xs font-bold text-emerald-400">
                  {grandTotal.toFixed(1)}h
                </td>
                <td colSpan={2} className="py-3 px-3 text-center text-[10px] text-[#8c9bab] font-mono">
                  {t('common.all')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Log Work Modal Dialog */}
      <LogWorkModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false);
          setSelectedIssueForLog(null);
        }}
        projectId={projectId}
        issueId={selectedIssueForLog?.id}
        initialIssue={selectedIssueForLog}
        onWorkLogged={fetchTimesheets}
      />
    </div>
  );
}

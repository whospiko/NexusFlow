import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge } from './PriorityBadge.jsx';
import { TagBadge } from './TagBadge.jsx';
import { KANBAN_COLUMNS, isValidTransition, ALLOWED_TRANSITIONS } from '../utils/stateMachine.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  MessageSquare,
  ShieldAlert,
  Plus,
  CheckCircle2,
  MoreHorizontal,
  Target,
} from 'lucide-react';

const JIRA_COLUMNS = [
  { id: 'open', titleKey: 'kanban.todo', dotColor: 'bg-[#8c9bab]' },
  { id: 'in-progress', titleKey: 'kanban.inProgress', dotColor: 'bg-[#579dff]' },
  { id: 'resolved', titleKey: 'kanban.inReview', dotColor: 'bg-[#c084fc]' },
  { id: 'closed', titleKey: 'kanban.done', dotColor: 'bg-[#4bce97]' },
];

function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function KanbanBoard({ issues = [], onTransition, onOpenCreateModal }) {
  const { t } = useLanguage();
  const [draggedIssue, setDraggedIssue] = useState(null);
  const [activeDropColumn, setActiveDropColumn] = useState(null);
  const [dropValidationState, setDropValidationState] = useState(null); // 'valid' | 'invalid'
  const [toastMessage, setToastMessage] = useState(null);

  // Group issues by column status
  const issuesByStatus = JIRA_COLUMNS.reduce((acc, col) => {
    acc[col.id] = issues.filter((i) => i.status === col.id);
    return acc;
  }, {});

  const showToast = (message, type = 'error') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, issue) => {
    setDraggedIssue(issue);
    e.dataTransfer.setData('text/plain', issue.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIssue(null);
    setActiveDropColumn(null);
    setDropValidationState(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (!draggedIssue) return;

    if (activeDropColumn !== colId) {
      setActiveDropColumn(colId);
      if (draggedIssue.status === colId) {
        setDropValidationState(null);
      } else {
        const valid = isValidTransition(draggedIssue.status, colId);
        setDropValidationState(valid ? 'valid' : 'invalid');
      }
    }
  };

  const handleDragLeave = (e, colId) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (activeDropColumn === colId) {
      setActiveDropColumn(null);
      setDropValidationState(null);
    }
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const issueToMove = draggedIssue;
    setActiveDropColumn(null);
    setDropValidationState(null);
    setDraggedIssue(null);

    if (!issueToMove) return;
    if (issueToMove.status === targetStatus) return;

    // Validate transition against state machine rules
    if (!isValidTransition(issueToMove.status, targetStatus)) {
      const allowed = ALLOWED_TRANSITIONS[issueToMove.status] || [];
      const allowedText = allowed.map((s) => t(`status.${s}`)).join(', ');
      showToast(
        t('kanban.moveNotAllowed', {
          from: t(`status.${issueToMove.status}`),
          to: t(`status.${targetStatus}`),
          allowed: allowedText,
        }),
        'error'
      );
      return;
    }

    try {
      await onTransition(issueToMove.id, targetStatus);
    } catch (err) {
      showToast(err.data?.message || err.message, 'error');
    }
  };

  const handleQuickMove = async (issueId, currentStatus, targetStatus, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await onTransition(issueId, targetStatus);
    } catch (err) {
      showToast(err.data?.message || err.message, 'error');
    }
  };

  return (
    <div className="relative">
      {/* Jira Toast Alert for status transitions */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 max-w-md p-4 rounded-lg shadow-2xl border flex items-start gap-3 z-50 transition-all ${
            toastMessage.type === 'error'
              ? 'bg-[#1c1417] border-rose-500/40 text-rose-300'
              : 'bg-[#101b17] border-emerald-500/40 text-emerald-300'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <ShieldAlert size={18} className="text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <strong className="block text-xs font-bold uppercase tracking-wider">
              {toastMessage.type === 'error' ? 'NexusFlow Workflow Guard' : t('common.success')}
            </strong>
            <p className="text-xs text-[#dfe1e6] mt-0.5 leading-relaxed">
              {toastMessage.message}
            </p>
          </div>
        </div>
      )}

      {/* 4-Column Jira Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 items-start overflow-x-auto pb-4">
        {JIRA_COLUMNS.map((column) => {
          const columnIssues = issuesByStatus[column.id] || [];
          const isTarget = activeDropColumn === column.id;
          const dropBorderClass = isTarget
            ? dropValidationState === 'valid'
              ? 'border-2 border-dashed border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20'
              : 'border-2 border-dashed border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/20'
            : 'border border-[#22273b] bg-[#121622]';

          return (
            <div
              key={column.id}
              className={`rounded-lg flex flex-col min-h-[550px] max-h-[calc(100vh-230px)] transition-all shadow-sm ${dropBorderClass}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Jira Column Header */}
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-[#1e2333] bg-[#161a23]/70 rounded-t-lg select-none">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9fadbc]">
                    {t(column.titleKey)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1e2333] text-[#8c9bab] border border-[#2e374f]">
                    {columnIssues.length}
                  </span>
                  {column.id === 'open' && (
                    <button
                      type="button"
                      onClick={onOpenCreateModal}
                      className="p-1 hover:bg-[#202738] rounded text-[#8c9bab] hover:text-[#dfe1e6] transition-colors"
                      title={t('projectDetail.createIssue')}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Cards Track */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1">
                {columnIssues.length === 0 ? (
                  <div className="h-28 flex items-center justify-center border border-dashed border-[#1e2333] rounded-md text-xs text-[#8c9bab] italic select-none">
                    {t('kanban.emptyCol')}
                  </div>
                ) : (
                  columnIssues.map((issue) => {
                    const isBeingDragged = draggedIssue?.id === issue.id;
                    const allowedNext = ALLOWED_TRANSITIONS[issue.status] || [];

                    return (
                      <div
                        key={issue.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, issue)}
                        onDragEnd={handleDragEnd}
                        className={`bg-[#181d28] border border-[#262c3f] hover:border-[#3b4460] hover:bg-[#1e2333] rounded-md p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none group ${
                          isBeingDragged ? 'opacity-30 scale-95 border-dashed border-[#579dff]' : ''
                        }`}
                      >
                        {/* Title link to Issue Detail */}
                        <Link
                          to={`/issues/${issue.id}`}
                          className="block text-xs font-semibold text-[#dfe1e6] group-hover:text-[#579dff] transition-colors line-clamp-2 leading-relaxed mb-2"
                        >
                          {issue.title}
                        </Link>

                        {/* Requirement Traceability (FR / NFR / Problem / Solution) */}
                        {issue.requirements && issue.requirements.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {issue.requirements.map((req) => (
                              <span
                                key={req.id}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  req.type === 'FR'
                                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                    : req.type === 'NFR'
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : req.type === 'problem'
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                }`}
                                title={`${req.code}: ${req.title} (${req.category})`}
                              >
                                <Target size={10} className="shrink-0 text-[#579dff]" />
                                <span className="font-mono">{req.code}</span>
                                <span className="text-[9px] uppercase px-1 rounded bg-black/40 font-mono">
                                  {req.type}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Tags Badges */}
                        {issue.tags && issue.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2.5">
                            {issue.tags.map((t) => (
                              <TagBadge key={t.id} tag={t} size="sm" />
                            ))}
                          </div>
                        )}

                        {/* Quick Move Transition Pill Options */}
                        {allowedNext.length > 0 && (
                          <div className="mb-2.5 flex items-center gap-1 text-[10px] text-[#8c9bab]">
                            <span className="opacity-75">{t('common.switch')}:</span>
                            {allowedNext.map((target) => (
                              <button
                                key={target}
                                type="button"
                                onClick={(e) => handleQuickMove(issue.id, issue.status, target, e)}
                                className="px-1.5 py-0.5 rounded bg-[#1e2333] hover:bg-[#282e42] border border-[#2e374f] hover:border-[#579dff]/50 text-[#dfe1e6] font-medium transition-colors cursor-pointer"
                                title={`${t('issueDetail.moveTo')} ${t(`status.${target}`)}`}
                              >
                                {t(`status.${target}`)}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Card Bottom Meta: Priority, Key, Assignee, Comments */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#22273b] text-[11px] text-[#8c9bab]">
                          {/* Priority Icon + Issue Key */}
                          <div className="flex items-center gap-1.5">
                            <PriorityBadge priority={issue.priority} showLabel={false} />
                            <Link
                              to={`/issues/${issue.id}`}
                              className="font-mono text-[11px] font-semibold text-[#8c9bab] hover:text-[#579dff] transition-colors"
                            >
                              ALPHA-{issue.id}
                            </Link>
                          </div>

                          {/* Comments + Assignee Avatar */}
                          <div className="flex items-center gap-2">
                            {issue.comment_count > 0 && (
                              <div
                                className="flex items-center gap-1 text-[#8c9bab] hover:text-[#579dff] transition-colors"
                                title={`${issue.comment_count} ${t('issueDetail.tabsComments')}`}
                              >
                                <MessageSquare size={12} />
                                <span>{issue.comment_count}</span>
                              </div>
                            )}

                            {/* Circular Assignee Avatar with Initials */}
                            <div
                              className="w-5 h-5 rounded-full bg-[#22273b] border border-[#2e374f] text-[9px] font-bold text-[#dfe1e6] flex items-center justify-center"
                              title={`${t('issueDetail.assignee')}: ${issue.assignee || t('common.unassigned')}`}
                            >
                              {getInitials(issue.assignee)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

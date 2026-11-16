import React from 'react';
import { StatusBadge } from './StatusBadge.jsx';
import { PriorityBadge } from './PriorityBadge.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  Sparkles,
  ArrowRight,
  MessageSquare,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  History,
  Tag,
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

export function ActivityTimeline({ activities = [] }) {
  const { t, formatRelativeTime } = useLanguage();

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-10 text-[#8c9bab]">
        <History size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs">{t('activity.noActivity')}</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#22273b]">
      {activities.map((act) => {
        let icon = <Clock size={12} className="text-[#8c9bab]" />;
        let content = null;

        switch (act.action_type) {
          case 'status_change':
            icon = <RefreshCw size={12} className="text-[#c084fc]" />;
            content = (
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">{t('activity.transitionedStatus')}</span>
                <StatusBadge status={act.old_value} />
                <ArrowRight size={12} className="text-[#8c9bab]" />
                <StatusBadge status={act.new_value} />
              </div>
            );
            break;

          case 'priority_change':
            icon = <AlertTriangle size={12} className="text-amber-400" />;
            content = (
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">{t('activity.changedPriority')}</span>
                <PriorityBadge priority={act.old_value} />
                <ArrowRight size={12} className="text-[#8c9bab]" />
                <PriorityBadge priority={act.new_value} />
              </div>
            );
            break;

          case 'assignee_change':
            icon = <UserCheck size={12} className="text-[#579dff]" />;
            content = (
              <div className="text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">{t('activity.reassignedIssue')} </span>
                <strong className="text-[#dfe1e6]">{act.old_value || t('common.unassigned')}</strong>
                <span className="text-[#8c9bab]"> {t('activity.to')} </span>
                <strong className="text-[#579dff]">{act.new_value || t('common.unassigned')}</strong>
              </div>
            );
            break;

          case 'issue_created':
            icon = <Sparkles size={12} className="text-[#4bce97]" />;
            content = (
              <div className="text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">{t('activity.createdIssue')}</span>
              </div>
            );
            break;

          case 'comment_added':
            icon = <MessageSquare size={12} className="text-[#579dff]" />;
            content = (
              <div className="text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">commented: </span>
                <span className="italic text-[#9fadbc]">"{act.new_value}"</span>
              </div>
            );
            break;

          case 'tag_added':
            icon = <Tag size={12} className="text-[#579dff]" />;
            content = (
              <div className="text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">attached label </span>
                <span className="font-semibold text-[#579dff]">#{act.new_value}</span>
              </div>
            );
            break;

          case 'tag_removed':
            icon = <Tag size={12} className="text-rose-400" />;
            content = (
              <div className="text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">removed label </span>
                <span className="font-semibold text-rose-400">#{act.old_value}</span>
              </div>
            );
            break;

          default:
            content = (
              <div className="text-xs text-[#dfe1e6]">
                <span className="text-[#8c9bab]">
                  {t('activity.updatedField', { field: act.field_name || 'issue' })}
                </span>
              </div>
            );
        }

        return (
          <div key={act.id} className="relative group">
            {/* Timeline Circle Avatar / Icon */}
            <div className="absolute -left-6 top-1 w-6 h-6 rounded-full bg-[#161a23] border border-[#2e374f] flex items-center justify-center z-10 shadow-sm">
              {icon}
            </div>

            {/* Event Content Container */}
            <div className="bg-[#161a23] border border-[#22273b] hover:border-[#2e374f] rounded-md p-3 transition-colors shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/30 text-[10px] font-bold text-indigo-300 flex items-center justify-center">
                    {getInitials(act.actor)}
                  </div>
                  <strong className="text-xs font-semibold text-[#dfe1e6]">
                    {act.actor}
                  </strong>
                </div>

                <span
                  className="text-[11px] text-[#8c9bab]"
                  title={new Date(act.created_at).toLocaleString()}
                >
                  {formatRelativeTime(act.created_at)}
                </span>
              </div>

              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React from 'react';
import { ChevronsUp, ChevronUp, Equal, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const priorityConfig = {
  critical: {
    key: 'priority.critical',
    icon: ChevronsUp,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  high: {
    key: 'priority.high',
    icon: ChevronUp,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 border-orange-500/20',
  },
  medium: {
    key: 'priority.medium',
    icon: Equal,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/20',
  },
  low: {
    key: 'priority.low',
    icon: ChevronDown,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
  },
};

export function PriorityBadge({ priority, showLabel = true }) {
  const { t } = useLanguage();
  const normalized = priority ? priority.toLowerCase() : 'medium';
  const conf = priorityConfig[normalized] || priorityConfig.medium;
  const Icon = conf.icon;
  const label = t(conf.key);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${conf.bg} ${conf.color} select-none`}
      title={`${t('issueDetail.priority')}: ${label}`}
    >
      <Icon size={13} strokeWidth={2.8} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

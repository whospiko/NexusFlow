import React from 'react';
import { CircleDot, PlayCircle, CheckCircle2, CheckSquare } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const statusConfig = {
  open: {
    key: 'status.open',
    bg: 'bg-[#1e2333] border-[#2e374f] text-[#9fadbc]',
    icon: CircleDot,
  },
  'in-progress': {
    key: 'status.in-progress',
    bg: 'bg-[#0c66e4]/15 border-[#0c66e4]/40 text-[#579dff]',
    icon: PlayCircle,
  },
  resolved: {
    key: 'status.resolved',
    bg: 'bg-[#9966ff]/15 border-[#9966ff]/40 text-[#c084fc]',
    icon: CheckCircle2,
  },
  closed: {
    key: 'status.closed',
    bg: 'bg-[#22a06b]/15 border-[#22a06b]/40 text-[#4bce97]',
    icon: CheckSquare,
  },
};

export function StatusBadge({ status }) {
  const { t } = useLanguage();
  const normalized = status ? status.toLowerCase() : 'open';
  const conf = statusConfig[normalized] || statusConfig.open;
  const Icon = conf.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold tracking-wider rounded border ${conf.bg} select-none transition-colors`}
    >
      <Icon size={11} strokeWidth={2.5} />
      <span>{t(conf.key)}</span>
    </span>
  );
}

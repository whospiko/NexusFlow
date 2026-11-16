import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from './StatusBadge.jsx';
import { PriorityBadge } from './PriorityBadge.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Flame,
  BatteryCharging,
  BatteryWarning,
  Activity,
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

export function WorkloadChart({ projectId }) {
  const { t } = useLanguage();
  const [workloadData, setWorkloadData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMembers, setExpandedMembers] = useState({});

  const fetchWorkload = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await api.getProjectWorkload(projectId);
      setWorkloadData(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load team workload data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWorkload();
  }, [fetchWorkload]);

  const toggleMemberExpand = (name) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Aggregated totals
  const totalCapacityHours = workloadData.length * 40;
  const totalEstimatedWorkload = workloadData.reduce(
    (sum, m) => sum + m.totalEstimatedHours,
    0
  );
  const totalLoggedHours = workloadData.reduce(
    (sum, m) => sum + m.totalLoggedHours,
    0
  );
  const overloadedCount = workloadData.filter((m) => m.capacityStatus === 'burnout_risk').length;
  const optimalCount = workloadData.filter((m) => m.capacityStatus === 'optimal').length;

  return (
    <div className="bg-[#121622] border border-[#22273b] rounded-xl overflow-hidden shadow-xl select-none">
      {/* Workload Header Toolbar */}
      <div className="p-4 bg-[#161a23] border-b border-[#22273b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Users size={16} />
            </div>
            <h2 className="text-sm font-bold text-[#dfe1e6]">{t('workload.title')}</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {workloadData.length} {t('projects.members')}
            </span>
          </div>
          <p className="text-xs text-[#8c9bab]">
            {t('workload.desc')}
          </p>
        </div>

        {/* Overview Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-[#0c1017] border border-[#262c3f] text-xs flex items-center gap-2">
            <span className="text-[#8c9bab]">{t('workload.assignedHours')}:</span>
            <strong className="text-[#dfe1e6] font-mono">
              {totalEstimatedWorkload.toFixed(0)}h / {totalCapacityHours}h (
              {totalCapacityHours > 0 ? Math.round((totalEstimatedWorkload / totalCapacityHours) * 100) : 0}%)
            </strong>
          </div>

          {overloadedCount > 0 ? (
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle size={13} />
              <span>{overloadedCount} {t('workload.overbooked')}</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              <span>{t('workload.balanced')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="m-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-16 text-center text-[#8c9bab] text-xs">
          <Clock size={22} className="animate-spin mx-auto mb-2 text-[#579dff]" />
          <span>{t('common.loading')}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && workloadData.length === 0 && (
        <div className="py-16 text-center text-[#8c9bab] text-xs">
          <p>{t('workload.noMembers')}</p>
        </div>
      )}

      {/* Workload Members List */}
      {!loading && workloadData.length > 0 && (
        <div className="divide-y divide-[#1e2436]">
          {workloadData.map((w) => {
            const isExpanded = !!expandedMembers[w.member.name];
            const pct = w.capacityPercentage;

            let barColor = 'bg-[#0c66e4]';
            let statusBadge = (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 size={10} /> {t('workload.balanced')}
              </span>
            );

            if (w.capacityStatus === 'burnout_risk') {
              barColor = 'bg-rose-500';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                  <Flame size={10} /> {t('workload.overbooked')}
                </span>
              );
            } else if (w.capacityStatus === 'underutilized') {
              barColor = 'bg-[#8c9bab]';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[#1e2333] text-[#8c9bab] border border-[#2e374f]">
                  {t('workload.underbooked')}
                </span>
              );
            }

            return (
              <div key={w.member.name} className="p-4 hover:bg-[#151a26] transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Member Profile */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => toggleMemberExpand(w.member.name)}
                      className="p-1 rounded text-[#8c9bab] hover:text-white hover:bg-[#1e2333] transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>

                    <img
                      src={w.member.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${w.member.name}`}
                      alt={w.member.name}
                      className="w-9 h-9 rounded-full bg-[#1e2333] ring-1 ring-[#2e374f]"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-[#dfe1e6]">
                          {w.member.name}
                        </strong>
                        {statusBadge}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#8c9bab] mt-0.5">
                        <span>{w.member.role || 'Contributor'}</span>
                        <span>•</span>
                        <span>{w.activeTasksCount} {t('workload.activeTasks')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Workload Progress Bar Gauge */}
                  <div className="flex-1 max-w-md">
                    <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                      <span className="text-[#8c9bab]">
                        {t('issueDetail.originalEstimate')}: <strong className="text-[#dfe1e6]">{w.totalEstimatedHours}h</strong> / 40h standard
                      </span>
                      <span className="text-xs font-bold text-[#dfe1e6]">{pct}%</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[#0c1017] border border-[#22273b] overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, pct)}%` }}
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      />
                    </div>
                  </div>

                  {/* Metrics Numbers */}
                  <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-[#8c9bab] uppercase">{t('issueDetail.logged')}</div>
                      <div className="font-bold text-emerald-400">{w.totalLoggedHours}h</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleMemberExpand(w.member.name)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-[#1e2333] hover:bg-[#283044] text-[#8c9bab] hover:text-[#dfe1e6] transition-colors cursor-pointer"
                    >
                      {isExpanded ? t('common.close') : t('common.view')}
                    </button>
                  </div>
                </div>

                {/* Collapsible Assigned Tasks Sub-Table */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-[#22273b] pl-10 space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9fadbc] mb-2">
                      {w.member.name} ({w.assignedTasks.length})
                    </h4>

                    {w.assignedTasks.length === 0 ? (
                      <p className="text-xs text-[#8c9bab] italic">{t('common.none')}</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {w.assignedTasks.map((task) => (
                          <Link
                            key={task.id}
                            to={`/issues/${task.id}`}
                            className="p-2.5 rounded-lg bg-[#0c1017] border border-[#22273b] hover:border-[#3b4460] flex items-center justify-between text-xs transition-colors group"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="font-mono text-[#579dff] text-[11px]">ALPHA-{task.id}</span>
                              <span className="truncate text-[#dfe1e6] group-hover:text-[#579dff]">
                                {task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              <StatusBadge status={task.status} />
                              <span className="text-[#8c9bab]">{task.estimated_hours}h</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

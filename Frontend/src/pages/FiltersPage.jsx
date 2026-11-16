import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { TagBadge } from '../components/TagBadge.jsx';
import {
  Filter,
  Search,
  Layers,
  Flame,
  UserCheck,
  CheckCircle2,
  Clock,
  MessageSquare,
  ChevronRight,
  Folder,
  Tag,
  SlidersHorizontal,
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

const PRESET_FILTERS = [
  { id: 'all', labelKey: 'filters.allIssues', icon: Layers },
  { id: 'my_open', labelKey: 'filters.myOpen', icon: UserCheck },
  { id: 'critical_blockers', labelKey: 'filters.criticalBlockers', icon: Flame },
  { id: 'in_progress', labelKey: 'filters.inProgressWork', icon: Clock },
  { id: 'done', labelKey: 'filters.doneResolved', icon: CheckCircle2 },
];

export function FiltersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Active Preset
  const [activePreset, setActivePreset] = useState(searchParams.get('preset') || 'all');

  // Filter States
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get('projectId') || 'all');
  const [selectedPriority, setSelectedPriority] = useState(searchParams.get('priority') || 'all');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all');
  const [selectedAssignee, setSelectedAssignee] = useState(searchParams.get('assignee') || 'all');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

  // Results
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load project list & team members once for dropdowns (scoped to current user)
  useEffect(() => {
    Promise.all([api.getProjects(), api.getTeams()])
      .then(([projRes, teamsRes]) => {
        setProjects(projRes.data || []);
        const allMembers = [];
        const seenIds = new Set();
        for (const team of (teamsRes.data || [])) {
          for (const m of (team.members || [])) {
            if (!seenIds.has(m.id)) {
              seenIds.add(m.id);
              allMembers.push(m);
            }
          }
        }
        setTeamMembers(allMembers);
      })
      .catch(() => {});
  }, [user]);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getFilteredIssues({
        preset: activePreset,
        projectId: selectedProject,
        priority: selectedPriority,
        status: selectedStatus,
        assignee: selectedAssignee,
        search: searchTerm,
        user: user?.name || 'User',
      });
      setIssues(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to query filtered issues');
    } finally {
      setLoading(false);
    }
  }, [activePreset, selectedProject, selectedPriority, selectedStatus, selectedAssignee, searchTerm, user]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleSelectPreset = (presetId) => {
    setActivePreset(presetId);
    setSelectedProject('all');
    setSelectedPriority('all');
    setSelectedStatus('all');
    setSelectedAssignee('all');
    setSearchTerm('');
  };

  const resetAllFilters = () => {
    setActivePreset('all');
    setSelectedProject('all');
    setSelectedPriority('all');
    setSelectedStatus('all');
    setSelectedAssignee('all');
    setSearchTerm('');
  };

  const currentPresetObj = PRESET_FILTERS.find((f) => f.id === activePreset);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] select-none">
      {/* Left Jira Preset Filters Sidebar */}
      <aside className="w-64 bg-[#11151f] border-r border-[#22273b] p-4 hidden md:flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase tracking-wider text-[#9fadbc]">
            <SlidersHorizontal size={14} className="text-[#579dff]" />
            <span>{t('nav.filters')}</span>
          </div>

          <nav className="space-y-1 text-xs font-medium">
            {PRESET_FILTERS.map((f) => {
              const Icon = f.icon;
              const isActive = activePreset === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectPreset(f.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold border border-[#0c66e4]/30 shadow-xs'
                      : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{t(f.labelKey)}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-3 border-t border-[#22273b] text-[11px] text-[#626f86]">
          Cross-Project Query Engine
        </div>
      </aside>

      {/* Main Filter Navigator Canvas */}
      <main className="flex-1 p-6 overflow-x-hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-[#22273b]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#8c9bab] mb-1">
              <span>{t('nav.filters')}</span>
              <ChevronRight size={12} />
              <span className="text-[#dfe1e6] font-semibold">
                {currentPresetObj ? t(currentPresetObj.labelKey) : t('common.search')}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#dfe1e6]">
              {t('filters.pageTitle')}
            </h1>
          </div>

          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs text-[#579dff] hover:text-[#85b8ff] font-medium cursor-pointer"
          >
            {t('filters.resetFilters')}
          </button>
        </div>

        {/* Filter Toolbar Controls */}
        <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-3.5 mb-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8c9bab]" />
              <input
                type="text"
                placeholder={t('filters.searchInput')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md pl-8 pr-3 py-1.5 outline-none placeholder-[#626f86] transition-all"
              />
            </div>

            {/* Project Selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#8c9bab]">
              <span>{t('filters.projectFilter')}:</span>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md px-2 py-1 outline-none transition-all cursor-pointer"
              >
                <option value="all">{t('projectDetail.allProjects')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#8c9bab]">
              <span>{t('filters.priorityFilter')}:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md px-2 py-1 outline-none transition-all cursor-pointer"
              >
                <option value="all">{t('projectDetail.filterPriority')}</option>
                <option value="critical">{t('priority.critical')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="low">{t('priority.low')}</option>
              </select>
            </div>

            {/* Status Selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#8c9bab]">
              <span>{t('filters.statusFilter')}:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md px-2 py-1 outline-none transition-all cursor-pointer"
              >
                <option value="all">{t('projectDetail.filterStatus')}</option>
                <option value="open">{t('status.open')}</option>
                <option value="in-progress">{t('status.in-progress')}</option>
                <option value="resolved">{t('status.resolved')}</option>
                <option value="closed">{t('status.closed')}</option>
              </select>
            </div>

            {/* Assignee Selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#8c9bab]">
              <span>{t('filters.assigneeFilter')}:</span>
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md px-2 py-1 outline-none transition-all cursor-pointer"
              >
                <option value="all">{t('projectDetail.filterAssignee')}</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Header Count */}
        <div className="flex items-center justify-between text-xs text-[#8c9bab] mb-3">
          <span>
            {t('filters.resultsFound', { count: issues.length })}
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center text-[#8c9bab] gap-3">
            <Clock size={24} className="animate-spin text-[#579dff]" />
            <span className="text-xs">{t('common.loading')}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 mb-4 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && issues.length === 0 && (
          <div className="py-16 text-center border border-dashed border-[#22273b] rounded-lg bg-[#121622]/50">
            <CheckCircle2 size={36} className="mx-auto mb-2 text-[#626f86]" />
            <h3 className="text-sm font-bold text-[#dfe1e6] mb-1">{t('filters.noIssuesMatched')}</h3>
            <p className="text-xs text-[#8c9bab] mb-3">
              {t('projectDetail.emptyIssues')}
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-semibold text-[#579dff] hover:underline cursor-pointer"
            >
              {t('filters.resetFilters')}
            </button>
          </div>
        )}

        {/* Issues Results Table */}
        {!loading && issues.length > 0 && (
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-[#121622] border-b border-[#22273b] text-[11px] font-bold uppercase tracking-wider text-[#8c9bab]">
              <div className="col-span-1">{t('projectDetail.tablePriority')}</div>
              <div className="col-span-2">{t('projectDetail.tableKey')}</div>
              <div className="col-span-3">{t('projectDetail.tableSummary')}</div>
              <div className="col-span-2">{t('filters.projectFilter')}</div>
              <div className="col-span-2">{t('projectDetail.tableStatus')}</div>
              <div className="col-span-1">{t('projectDetail.tableAssignee')}</div>
              <div className="col-span-1 text-right">{t('issueDetail.tabsComments')}</div>
            </div>

            <div className="divide-y divide-[#22273b]">
              {issues.map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.id}`}
                  className="grid grid-cols-12 px-4 py-3 items-center hover:bg-[#1a202e] transition-colors text-xs text-[#dfe1e6] group"
                >
                  <div className="col-span-1">
                    <PriorityBadge priority={issue.priority} showLabel={false} />
                  </div>

                  <div className="col-span-2 font-mono font-semibold text-[#8c9bab] group-hover:text-[#579dff] transition-colors">
                    ALPHA-{issue.id}
                  </div>

                  <div className="col-span-3 pr-2">
                    <div className="font-medium group-hover:text-[#579dff] transition-colors truncate">
                      {issue.title}
                    </div>
                    {issue.tags && issue.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {issue.tags.map((t) => (
                          <TagBadge key={t.id} tag={t} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 text-[#8c9bab] truncate">
                    <span className="px-2 py-0.5 rounded bg-[#1e2333] border border-[#2e374f] text-[11px]">
                      {issue.project_name}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={issue.status} />
                  </div>

                  <div className="col-span-1 flex items-center gap-1.5 text-[#8c9bab]">
                    <div className="w-5 h-5 rounded-full bg-[#22273b] border border-[#2e374f] text-[9px] font-bold text-[#dfe1e6] flex items-center justify-center shrink-0">
                      {getInitials(issue.assignee)}
                    </div>
                    <span className="truncate hidden sm:inline">{issue.assignee?.split(' ')[0] || '—'}</span>
                  </div>

                  <div className="col-span-1 text-right font-medium text-[#8c9bab] flex items-center justify-end gap-1">
                    <MessageSquare size={12} />
                    <span>{issue.comment_count || 0}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

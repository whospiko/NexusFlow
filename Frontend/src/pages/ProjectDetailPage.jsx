import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { TagBadge } from '../components/TagBadge.jsx';
import { CreateIssueModal } from '../components/CreateIssueModal.jsx';
import { InviteMemberModal } from '../components/InviteMemberModal.jsx';
import { EditProjectModal } from '../components/EditProjectModal.jsx';
import { DuplicateProjectModal } from '../components/DuplicateProjectModal.jsx';
import { VersionHistoryView } from '../components/VersionHistoryView.jsx';
import { KanbanBoard } from '../components/KanbanBoard.jsx';
import { GanttChart } from '../components/GanttChart.jsx';
import { TimesheetView } from '../components/TimesheetView.jsx';
import { WorkloadChart } from '../components/WorkloadChart.jsx';
import { RequirementsEngineeringView } from '../components/RequirementsEngineeringView.jsx';
import { ErdDashboard } from '../components/erd/ErdDashboard.jsx';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Search,
  Filter,
  User,
  Clock,
  Layers,
  CheckCircle,
  LayoutGrid,
  List,
  Tag,
  Kanban,
  FileText,
  Sliders,
  ChevronRight,
  UserPlus,
  Users,
  Shield,
  Lock,
  Edit3,
  Settings,
  Calendar,
  FileSpreadsheet,
  Activity,
  Target,
  GitBranch,
  Copy,
  Database,
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

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [project, setProject] = useState(null);
  const [issues, setIssues] = useState([]);
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [latestVersion, setLatestVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View Mode: 'board' (Kanban) or 'list' (Table)
  const [viewMode, setViewMode] = useState('board');

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  useEffect(() => {
    api.getTags()
      .then((res) => setAllTags(res.data || []))
      .catch(() => setAllTags([]));
  }, []);

  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, issuesRes, membersRes, versionsRes] = await Promise.all([
        api.getProject(projectId),
        api.getIssues(projectId, {
          status: viewMode === 'board' ? 'all' : statusFilter,
          priority: priorityFilter,
          tag: tagFilter,
          search: searchTerm,
        }),
        api.getProjectMembers(projectId).catch(() => ({ data: [], pending: [] })),
        api.getProjectVersions(projectId).catch(() => ({ data: [] })),
      ]);
      setProject(projRes.data);
      setIssues(issuesRes.data || []);
      setMembers(membersRes?.data || []);
      setPendingMembers(membersRes?.pending || []);

      const verList = Array.isArray(versionsRes) ? versionsRes : (versionsRes?.data || []);
      setLatestVersion(verList.length > 0 ? verList[0] : null);

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [projectId, viewMode, statusFilter, priorityFilter, tagFilter, searchTerm]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleIssueCreated = async (newIssue) => {
    await api.createIssue(projectId, newIssue);
    await fetchProjectData();
  };

  const handleStatusTransition = async (issueId, targetStatus) => {
    setIssues((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, status: targetStatus } : i))
    );

    try {
      await api.updateIssueStatus(issueId, targetStatus);
    } catch (err) {
      await fetchProjectData();
      throw err;
    }
  };

  // Extract unique assignees for Jira avatar quick-filter
  const uniqueAssignees = Array.from(
    new Set(issues.map((i) => i.assignee).filter(Boolean))
  );

  const displayedIssues = issues.filter((i) => {
    if (assigneeFilter !== 'all' && i.assignee !== assigneeFilter) return false;
    return true;
  });

  if (error && error.includes('Access denied')) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6 bg-[#070d19]">
        <div className="max-w-md w-full bg-[#111c2e] border border-amber-900/60 rounded-xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Lock size={26} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Restricted Project Workspace</h2>
          <p className="text-xs text-[#8c9bab] mb-6 leading-relaxed">
            {error}
          </p>
          <div className="space-y-3">
            <Link
              to="/projects"
              className="w-full inline-block py-2.5 px-4 bg-[#0052cc] hover:bg-[#0747a6] text-white rounded-lg text-xs font-bold transition-colors"
            >
              Return to My Projects Directory
            </Link>
            <p className="text-[11px] text-[#626f86]">
              Signed in as <strong className="text-blue-300">{user?.name}</strong> ({user?.email}). Switch accounts via the top-right profile menu if you were invited under a different email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Jira Left Project Sidebar */}
      <aside className="w-56 bg-[#11151f] border-r border-[#22273b] p-3 hidden md:flex flex-col justify-between shrink-0 select-none">
        <div className="space-y-4">
          {/* Project Avatar & Title */}
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#0052cc] to-[#0c66e4] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {project?.name?.substring(0, 2).toUpperCase() || 'PJ'}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-xs font-bold text-[#dfe1e6] truncate leading-tight">
                {project?.name || 'Loading...'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-[#8c9bab]">Software Project</span>
                {latestVersion && (
                  <button
                    type="button"
                    onClick={() => setViewMode('versions')}
                    className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer"
                    title="Active Project Architecture Version"
                  >
                    {latestVersion.version_tag}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <Kanban size={14} />
              <span>{t('projectDetail.kanbanBoard')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <List size={14} />
              <span>{t('projectDetail.issuesList')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'gantt'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <Calendar size={14} />
              <span>{t('projectDetail.ganttTimeline')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('timesheet')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'timesheet'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>{t('projectDetail.timesheet')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('workload')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'workload'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <Activity size={14} />
              <span>{t('projectDetail.workload')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('requirements')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'requirements'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <Target size={14} />
              <span>{t('projectDetail.requirements')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('versions')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'versions'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <GitBranch size={14} />
              <span>{t('projectDetail.versions')}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('erd')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors text-left cursor-pointer ${
                viewMode === 'erd'
                  ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
              }`}
            >
              <Database size={14} />
              <span>{t('projectDetail.erdModeler') || 'ERD & Data Modeler'}</span>
            </button>

            <div className="pt-2 text-[10px] font-bold uppercase tracking-wider text-[#626f86] px-2.5">
              {t('projectDetail.projectViews')}
            </div>

            <Link
              to="/"
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e] transition-colors"
            >
              <Layers size={14} />
              <span>{t('projectDetail.allProjects')}</span>
            </Link>

            {project?.is_owner && (
              <button
                type="button"
                onClick={() => setIsEditProjectModalOpen(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[#8c9bab] hover:text-[#579dff] hover:bg-[#1a202e] transition-colors text-left cursor-pointer"
              >
                <Settings size={14} />
                <span>{t('projectDetail.projectSettings')}</span>
              </button>
            )}
          </nav>
        </div>
      </aside>

      {/* Main Project Board Canvas */}
      <main className="flex-1 p-6 overflow-x-hidden">
        {/* Jira Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs text-[#8c9bab] mb-3 select-none flex-wrap">
          <Link to="/" className="hover:text-[#579dff] transition-colors">
            {t('nav.projects')}
          </Link>
          <ChevronRight size={12} />
          <span className="text-[#dfe1e6] font-medium flex items-center gap-1.5">
            <span>{project?.name || 'Project'}</span>
            {latestVersion && (
              <button
                type="button"
                onClick={() => setViewMode('versions')}
                className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer"
                title="Active Version Snapshot"
              >
                {latestVersion.version_tag}
              </button>
            )}
          </span>
          <ChevronRight size={12} />
          <span className="text-[#8c9bab] font-medium">
            {viewMode === 'board'
              ? t('projectDetail.kanbanBoard')
              : viewMode === 'list'
              ? t('projectDetail.issuesList')
              : viewMode === 'gantt'
              ? t('projectDetail.ganttTimeline')
              : viewMode === 'timesheet'
              ? t('projectDetail.timesheet')
              : viewMode === 'workload'
              ? t('projectDetail.workload')
              : viewMode === 'requirements'
              ? t('projectDetail.requirements')
              : viewMode === 'versions'
              ? t('projectDetail.versions')
              : viewMode === 'erd'
              ? (t('projectDetail.erdModeler') || 'ERD & Data Modeler')
              : viewMode}
          </span>
        </div>

        {/* Board Header Bar */}
        <div className="space-y-4 mb-5 pb-4 border-b border-[#22273b]">
          {/* Row 1: Title & Description on Left, Team Avatars & Primary Actions on Right */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1 min-w-0 max-w-3xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-[#dfe1e6] tracking-tight">
                  {viewMode === 'board'
                    ? t('projectDetail.kanbanBoard')
                    : viewMode === 'list'
                    ? t('projectDetail.issuesList')
                    : viewMode === 'gantt'
                    ? t('projectDetail.ganttTimeline')
                    : viewMode === 'timesheet'
                    ? t('projectDetail.timesheet')
                    : viewMode === 'workload'
                    ? t('projectDetail.workload')
                    : viewMode === 'requirements'
                    ? t('projectDetail.requirements')
                    : viewMode === 'versions'
                    ? t('projectDetail.versions')
                    : viewMode === 'erd'
                    ? (t('projectDetail.erdModeler') || 'ERD & Data Modeler')
                    : viewMode}
                </h1>
                {latestVersion && (
                  <button
                    type="button"
                    onClick={() => setViewMode('versions')}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-colors cursor-pointer shadow-xs"
                    title="Architecture Baseline Version - Click to open Version History"
                  >
                    <GitBranch size={11} />
                    <span>{latestVersion.version_tag}</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-[#8c9bab] mt-1.5 leading-relaxed">
                {project?.description || t('issueDetail.noDescription')}
              </p>
            </div>

            {/* Right: Team Members & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 select-none">
              {/* Team Members Avatar Stack */}
              <div className="flex items-center bg-[#121622] border border-[#22273b] rounded-lg px-2.5 py-1 gap-2">
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {members.slice(0, 4).map((m) => (
                    <img
                      key={m.id}
                      src={m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`}
                      alt={m.name}
                      title={`${m.name} (${m.role})`}
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-[#121622] bg-[#1e2333]"
                    />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-[#8c9bab]">
                  {members.length} {t('projects.members')}
                </span>

                {/* Pending Gmail Verification Badge */}
                {pendingMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded cursor-pointer hover:bg-amber-500/25 transition-colors"
                    title="Click to view pending Gmail verifications"
                  >
                    <Clock size={11} className="text-amber-400" />
                    <span>{pendingMembers.length} {t('projectDetail.invitedLabel')}</span>
                  </button>
                )}

                {/* Invite Teammate Button */}
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded bg-[#0c66e4]/20 hover:bg-[#0c66e4]/30 text-[#579dff] text-xs font-semibold border border-[#0c66e4]/40 transition-colors cursor-pointer"
                  title="Invite team member via Gmail"
                >
                  <UserPlus size={12} />
                  <span>{t('projectDetail.inviteMember')}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#161a23] hover:bg-[#1f2638] text-[#dfe1e6] hover:text-indigo-400 text-xs font-semibold border border-[#262c3f] transition-colors cursor-pointer"
                title={t('projectDetail.duplicate')}
              >
                <Copy size={13} />
                <span>{t('projectDetail.duplicate')}</span>
              </button>

              {project?.is_owner && (
                <button
                  type="button"
                  onClick={() => setIsEditProjectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#161a23] hover:bg-[#1f2638] text-[#dfe1e6] hover:text-[#579dff] text-xs font-semibold border border-[#262c3f] transition-colors cursor-pointer"
                  title="Edit project settings"
                >
                  <Settings size={13} />
                  <span>{t('common.edit')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={14} strokeWidth={2.8} />
                <span>{t('projectDetail.createIssue')}</span>
              </button>
            </div>
          </div>

          {/* Row 2: View Switcher Toggle spanning full width */}
          <div className="flex items-center max-w-full overflow-x-auto no-scrollbar bg-[#121622] border border-[#22273b] rounded-lg p-1 flex-nowrap scroll-smooth">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'board'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <LayoutGrid size={13} />
              <span>{t('projectDetail.kanbanBoard')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <List size={13} />
              <span>{t('projectDetail.issuesList')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'gantt'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <Calendar size={13} />
              <span>{t('projectDetail.ganttTimeline')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timesheet')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'timesheet'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>{t('projectDetail.timesheet')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('workload')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'workload'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <Activity size={13} />
              <span>{t('projectDetail.workload')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('requirements')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'requirements'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <Target size={13} />
              <span>{t('projectDetail.requirements')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('versions')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'versions'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <GitBranch size={13} />
              <span>{t('projectDetail.versions')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('erd')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                viewMode === 'erd'
                  ? 'bg-[#1e2433] text-[#579dff] shadow-sm font-bold'
                  : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#161b26]'
              }`}
            >
              <Database size={13} />
              <span>ERD Modeler</span>
            </button>
          </div>
        </div>

        {/* Jira Filter Toolbar (Search + Assignees + Priority + Labels) */}
        {(viewMode === 'board' || viewMode === 'list') && (
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-3 mb-5 space-y-3 shadow-sm select-none">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8c9bab]" />
              <input
                type="text"
                placeholder={t('projectDetail.searchIssues')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md pl-8 pr-3 py-1.5 outline-none placeholder-[#626f86] transition-all"
              />
            </div>

            {/* Jira Assignee Quick-Filter Avatars */}
            {uniqueAssignees.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#8c9bab]">{t('issueDetail.assignee')}:</span>
                <button
                  type="button"
                  onClick={() => setAssigneeFilter('all')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    assigneeFilter === 'all'
                      ? 'bg-[#0c66e4]/20 text-[#579dff] font-semibold border border-[#0c66e4]/30'
                      : 'text-[#8c9bab] hover:text-[#dfe1e6]'
                  }`}
                >
                  {t('common.all')}
                </button>
                {uniqueAssignees.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setAssigneeFilter(assigneeFilter === name ? 'all' : name)}
                    className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                      assigneeFilter === name
                        ? 'bg-[#579dff] text-white ring-2 ring-[#579dff]/40 shadow-sm'
                        : 'bg-[#1e2333] text-[#8c9bab] hover:text-[#dfe1e6] border border-[#2e374f]'
                    }`}
                    title={`${t('common.filter')}: ${name}`}
                  >
                    {getInitials(name)}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Filter Presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setAssigneeFilter(assigneeFilter === 'Piko' ? 'all' : 'Piko')}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  assigneeFilter === 'Piko'
                    ? 'bg-[#0c66e4]/20 border-[#0c66e4]/40 text-[#579dff] font-semibold'
                    : 'bg-[#0c1017] border-[#2e374f] text-[#8c9bab] hover:text-[#dfe1e6]'
                }`}
              >
                {t('filters.myOpen')}
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter(priorityFilter === 'critical' ? 'all' : 'critical')}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  priorityFilter === 'critical'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 font-semibold'
                    : 'bg-[#0c1017] border-[#2e374f] text-[#8c9bab] hover:text-[#dfe1e6]'
                }`}
              >
                {t('priority.critical')}
              </button>
              {(assigneeFilter !== 'all' || priorityFilter !== 'all' || tagFilter !== 'all' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setAssigneeFilter('all');
                    setPriorityFilter('all');
                    setTagFilter('all');
                    setStatusFilter('all');
                    setSearchTerm('');
                  }}
                  className="px-2 py-1 rounded text-xs text-rose-400 hover:underline cursor-pointer"
                >
                  {t('filters.resetFilters')}
                </button>
              )}
            </div>

            {/* Priority Filter Dropdown */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-[#8c9bab]">{t('issueDetail.priority')}:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md px-2 py-1 outline-none transition-all cursor-pointer"
              >
                <option value="all">{t('projectDetail.filterPriority')}</option>
                <option value="critical">{t('priority.critical')}</option>
                <option value="high">{t('priority.high')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="low">{t('priority.low')}</option>
              </select>
            </div>

            {/* Status Filter (only in List view) */}
            {viewMode === 'list' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#8c9bab]">{t('issueDetail.status')}:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md px-2 py-1 outline-none transition-all cursor-pointer"
                >
                  <option value="all">{t('projectDetail.filterStatus')}</option>
                  <option value="open">{t('status.open')}</option>
                  <option value="in-progress">{t('status.in-progress')}</option>
                  <option value="resolved">{t('status.resolved')}</option>
                  <option value="closed">{t('status.closed')}</option>
                </select>
              </div>
            )}
          </div>

          {/* Labels / Tags Quick Filter Bar */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-[#22273b]">
              <span className="text-[11px] text-[#8c9bab] flex items-center gap-1">
                <Tag size={11} className="text-[#579dff]" /> {t('issueDetail.tags')}:
              </span>
              <button
                type="button"
                onClick={() => setTagFilter('all')}
                className={`px-2 py-0.5 rounded-full text-[11px] transition-colors cursor-pointer ${
                  tagFilter === 'all'
                    ? 'bg-[#1e2333] text-[#579dff] font-semibold border border-[#2e374f]'
                    : 'text-[#8c9bab] hover:text-[#dfe1e6]'
                }`}
              >
                {t('common.all')}
              </button>
              {allTags.map((t) => {
                const active = tagFilter === t.name;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTagFilter(active ? 'all' : t.name)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 border ${
                      active
                        ? 'border-transparent text-white'
                        : 'bg-[#0c1017] border-[#2e374f] text-[#8c9bab] hover:text-[#dfe1e6]'
                    }`}
                    style={{
                      backgroundColor: active ? t.color : undefined,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{
                        backgroundColor: active ? '#ffffff' : t.color,
                      }}
                    />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        )}

        {/* Database Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* View Content: Gantt vs Timesheet vs Workload vs Kanban vs List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#8c9bab] gap-3">
            <Clock size={24} className="animate-spin text-[#579dff]" />
            <span className="text-xs">Loading NexusFlow project data...</span>
          </div>
        ) : viewMode === 'gantt' ? (
          /* Gantt Timeline Chart */
          <GanttChart
            issues={issues}
            projectId={projectId}
            onOpenCreateModal={() => setIsModalOpen(true)}
            onIssueUpdated={fetchProjectData}
          />
        ) : viewMode === 'timesheet' ? (
          /* Online Timesheets Grid */
          <TimesheetView
            projectId={projectId}
            issues={issues}
          />
        ) : viewMode === 'workload' ? (
          /* Workload Capacity Management */
          <WorkloadChart
            projectId={projectId}
          />
        ) : viewMode === 'requirements' ? (
          /* ITPM & SE Requirements Engineering & Traceability Matrix (RETM) */
          <RequirementsEngineeringView
            projectId={projectId}
            projectTasks={issues}
          />
        ) : viewMode === 'versions' ? (
          /* Project Version History & Snapshots */
          <VersionHistoryView
            projectId={projectId}
            project={project}
            onNavigateToProject={(newId) => navigate(`/projects/${newId}`)}
          />
        ) : viewMode === 'erd' ? (
          /* ERD & Relational Data Modeling Engine (Modules 2, 3, 4, 5) */
          <ErdDashboard projectId={projectId} />
        ) : viewMode === 'board' ? (
          /* Kanban Board View */
          <KanbanBoard
            issues={displayedIssues}
            onTransition={handleStatusTransition}
            onOpenCreateModal={() => setIsModalOpen(true)}
          />
        ) : displayedIssues.length === 0 ? (
          /* Empty List View */
          <div className="py-16 text-center border border-dashed border-[#22273b] rounded-lg bg-[#121622]/50">
            <CheckCircle size={36} className="mx-auto mb-2 text-[#626f86]" />
            <h3 className="text-sm font-bold text-[#dfe1e6] mb-1">{t('projectDetail.emptyIssues')}</h3>
            <p className="text-xs text-[#8c9bab] mb-3">
              {t('projectDetail.createFirstIssue')}
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>{t('projectDetail.createIssue')}</span>
            </button>
          </div>
        ) : (
          /* Jira Table List View */
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-[#121622] border-b border-[#22273b] text-[11px] font-bold uppercase tracking-wider text-[#8c9bab] select-none">
              <div className="col-span-1">{t('projectDetail.tablePriority')}</div>
              <div className="col-span-2">{t('projectDetail.tableKey')}</div>
              <div className="col-span-4">{t('projectDetail.tableSummary')}</div>
              <div className="col-span-2">{t('projectDetail.tableStatus')}</div>
              <div className="col-span-2">{t('projectDetail.tableAssignee')}</div>
              <div className="col-span-1 text-right">{t('issueDetail.tabsComments')}</div>
            </div>

            <div className="divide-y divide-[#22273b]">
              {displayedIssues.map((issue) => (
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

                  <div className="col-span-4 pr-3">
                    <div className="font-medium group-hover:text-[#579dff] transition-colors truncate">
                      {issue.title}
                    </div>
                    {/* Requirement Traceability Pill */}
                    {issue.requirements && issue.requirements.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {issue.requirements.map((req) => (
                          <span
                            key={req.id}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              req.type === 'FR'
                                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                : req.type === 'NFR'
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : 'bg-slate-500/15 text-slate-300 border-slate-500/30'
                            }`}
                            title={`${req.code}: ${req.title}`}
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
                    {issue.tags && issue.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {issue.tags.map((t) => (
                          <TagBadge key={t.id} tag={t} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={issue.status} />
                  </div>

                  <div className="col-span-2 flex items-center gap-1.5 text-[#8c9bab]">
                    <div className="w-5 h-5 rounded-full bg-[#22273b] border border-[#2e374f] text-[9px] font-bold text-[#dfe1e6] flex items-center justify-center shrink-0">
                      {getInitials(issue.assignee)}
                    </div>
                    <span className="truncate">{issue.assignee || t('common.unassigned')}</span>
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

      <CreateIssueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onIssueCreated={handleIssueCreated}
        projectId={projectId}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        projectId={projectId}
        projectName={project?.name || 'Project'}
        onMemberInvited={fetchProjectData}
      />

      <EditProjectModal
        isOpen={isEditProjectModalOpen}
        onClose={() => setIsEditProjectModalOpen(false)}
        project={project}
        onProjectUpdated={(updated) => setProject((prev) => ({ ...prev, ...updated }))}
      />

      <DuplicateProjectModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        project={project}
        onDuplicated={(newProj) => {
          if (newProj?.id) {
            navigate(`/projects/${newProj.id}`);
          } else {
            fetchProjectData();
          }
        }}
      />
    </div>
  );
}

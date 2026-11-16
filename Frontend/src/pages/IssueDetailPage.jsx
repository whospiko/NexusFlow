import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PriorityBadge } from '../components/PriorityBadge.jsx';
import { TagBadge } from '../components/TagBadge.jsx';
import { StateTransitionControl } from '../components/StateTransitionControl.jsx';
import { ActivityTimeline } from '../components/ActivityTimeline.jsx';
import { EditIssueModal } from '../components/EditIssueModal.jsx';
import { LogWorkModal } from '../components/LogWorkModal.jsx';
import { LinkTaskModal } from '../components/LinkTaskModal.jsx';
import {
  ArrowLeft,
  User,
  Calendar,
  MessageSquare,
  Send,
  Trash2,
  Clock,
  Layers,
  FileText,
  AlertCircle,
  History,
  Tag,
  ChevronRight,
  Share2,
  Check,
  MoreHorizontal,
  Edit3,
  Pencil,
  X,
  ChevronDown,
  Sparkles,
  Link2,
  AlertTriangle,
  Target,
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

export function IssueDetailPage() {
  const { issueId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [allAvailableTags, setAllAvailableTags] = useState([]);
  const [activeTab, setActiveTab] = useState('comments'); // 'comments' | 'history' | 'worklogs'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Edit Issue & Log Work Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLogWorkOpen, setIsLogWorkOpen] = useState(false);

  // ITPM Task Dependencies State
  const [dependencies, setDependencies] = useState({ predecessors: [], successors: [] });
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [projectIssues, setProjectIssues] = useState([]);
  const [allProjectDeps, setAllProjectDeps] = useState([]);

  // Comment Form State
  const [commentAuthor, setCommentAuthor] = useState(user?.name || 'Piko');
  const [commentContent, setCommentContent] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Comment Inline Edit State
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [commentUpdating, setCommentUpdating] = useState(false);

  // Quick Inline Edit States (Sidebar Details)
  const [projectMembers, setProjectMembers] = useState([]);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showReporterDropdown, setShowReporterDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [assigneeUpdating, setAssigneeUpdating] = useState(false);
  const [reporterUpdating, setReporterUpdating] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setCommentAuthor(user.name);
    }
  }, [user]);

  useEffect(() => {
    api.getTags()
      .then((res) => setAllAvailableTags(res.data || []))
      .catch(() => setAllAvailableTags([]));
  }, []);

  const fetchIssueAndData = useCallback(async () => {
    try {
      setLoading(true);
      const [issueRes, commentsRes, activitiesRes, timeLogsRes, depsRes] = await Promise.all([
        api.getIssue(issueId),
        api.getComments(issueId),
        api.getActivities(issueId).catch(() => ({ data: [] })),
        api.getTimeLogs(issueId).catch(() => ({ data: [] })),
        api.getIssueDependencies(issueId).catch(() => ({ data: { predecessors: [], successors: [] } })),
      ]);
      setIssue(issueRes.data);
      setComments(commentsRes.data || []);
      setActivities(activitiesRes.data || []);
      setTimeLogs(timeLogsRes.data || []);
      setDependencies(depsRes.data || { predecessors: [], successors: [] });
      setError(null);

      if (issueRes.data?.project_id) {
        api.getProjectMembers(issueRes.data.project_id)
          .then((mRes) => setProjectMembers(mRes.data || []))
          .catch(() => setProjectMembers([]));

        api.getIssues(issueRes.data.project_id)
          .then((iRes) => setProjectIssues(iRes.data || []))
          .catch(() => setProjectIssues([]));

        api.getProjectDependencies(issueRes.data.project_id)
          .then((pDeps) => setAllProjectDeps(pDeps.data || []))
          .catch(() => setAllProjectDeps([]));
      }
    } catch (err) {
      setError(err.message || 'Failed to load issue');
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    fetchIssueAndData();
  }, [fetchIssueAndData]);

  const handleDeleteTimeLog = async (logId) => {
    if (!window.confirm(t('issueDetail.deleteLogConfirm'))) return;
    try {
      await api.deleteTimeLog(logId);
      setTimeLogs((prev) => prev.filter((l) => l.id !== logId));
      await fetchIssueAndData();
      await refreshActivities();
    } catch (err) {
      alert(`Failed to delete time log: ${err.message}`);
    }
  };

  const handleQuickUpdatePriority = async (newPriority) => {
    if (!newPriority || newPriority.toLowerCase() === issue?.priority?.toLowerCase()) {
      setShowPriorityDropdown(false);
      return;
    }
    setPriorityUpdating(true);
    try {
      const res = await api.updateIssue(issueId, {
        priority: newPriority.toLowerCase(),
        actor: user?.name || 'User',
      });
      setIssue((prev) => ({
        ...prev,
        priority: newPriority.toLowerCase(),
        updated_at: res.data.updated_at,
      }));
      await refreshActivities();
    } catch (err) {
      alert(`Failed to update priority: ${err.message}`);
    } finally {
      setPriorityUpdating(false);
      setShowPriorityDropdown(false);
    }
  };

  const handleQuickUpdateAssignee = async (newAssignee) => {
    setAssigneeUpdating(true);
    try {
      const res = await api.updateIssue(issueId, {
        assignee: newAssignee || null,
        actor: user?.name || 'User',
      });
      setIssue((prev) => ({
        ...prev,
        assignee: newAssignee || null,
        updated_at: res.data.updated_at,
      }));
      await refreshActivities();
    } catch (err) {
      alert(`Failed to update assignee: ${err.message}`);
    } finally {
      setAssigneeUpdating(false);
      setShowAssigneeDropdown(false);
    }
  };

  const handleQuickUpdateReporter = async (newReporter) => {
    if (!newReporter) return;
    setReporterUpdating(true);
    try {
      const res = await api.updateIssue(issueId, {
        creator: newReporter,
        actor: user?.name || 'User',
      });
      setIssue((prev) => ({
        ...prev,
        creator: newReporter,
        updated_at: res.data.updated_at,
      }));
      await refreshActivities();
    } catch (err) {
      alert(`Failed to update reporter: ${err.message}`);
    } finally {
      setReporterUpdating(false);
      setShowReporterDropdown(false);
    }
  };

  const refreshActivities = async () => {
    try {
      const res = await api.getActivities(issueId);
      setActivities(res.data || []);
    } catch (err) {
      console.warn('Failed to refresh activity timeline:', err);
    }
  };

  const handleAddTag = async (tagId) => {
    if (!tagId) return;
    try {
      const res = await api.attachTagToIssue(issueId, tagId, 'Piko');
      setIssue((prev) => ({ ...prev, tags: res.data }));
      await refreshActivities();
    } catch (err) {
      alert(`Failed to attach tag: ${err.message}`);
    }
  };

  const handleRemoveTag = async (tagId) => {
    try {
      const res = await api.removeTagFromIssue(issueId, tagId, 'Piko');
      setIssue((prev) => ({ ...prev, tags: res.data }));
      await refreshActivities();
    } catch (err) {
      alert(`Failed to remove tag: ${err.message}`);
    }
  };

  const handleTransition = async (targetStatus) => {
    setActionLoading(true);
    try {
      const res = await api.updateIssueStatus(issueId, targetStatus);
      setIssue((prev) => ({
        ...prev,
        status: res.data.status,
        allowed_transitions: res.data.allowed_transitions,
      }));
      await refreshActivities();
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim() || !commentAuthor.trim()) return;

    setCommentSubmitting(true);
    try {
      const res = await api.createComment(issueId, {
        author: commentAuthor.trim(),
        content: commentContent.trim(),
      });
      setComments((prev) => [...prev, res.data]);
      setCommentContent('');
      setIssue((prev) => ({ ...prev, comment_count: (prev.comment_count || 0) + 1 }));
      await refreshActivities();
    } catch (err) {
      alert(`Failed to add comment: ${err.message}`);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent('');
  };

  const handleSaveEditComment = async (commentId) => {
    if (!editingCommentContent.trim()) return;
    setCommentUpdating(true);
    try {
      const res = await api.updateComment(commentId, {
        content: editingCommentContent.trim(),
        author: user?.name || commentAuthor,
      });
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, content: res.data.content, updated_at: res.data.updated_at } : c))
      );
      setEditingCommentId(null);
      setEditingCommentContent('');
      await refreshActivities();
    } catch (err) {
      alert(`Failed to update comment: ${err.message}`);
    } finally {
      setCommentUpdating(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm(t('issueDetail.confirmDeleteComment'))) return;
    try {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setIssue((prev) => ({ ...prev, comment_count: Math.max(0, (prev.comment_count || 1) - 1) }));
    } catch (err) {
      alert(`Failed to delete comment: ${err.message}`);
    }
  };

  const handleDeleteIssue = async () => {
    if (!window.confirm(t('issueDetail.confirmDeleteIssue', { key: `ALPHA-${issue?.id}` }))) return;
    try {
      await api.deleteIssue(issueId);
      navigate(`/projects/${issue.project_id}`);
    } catch (err) {
      alert(`Failed to delete issue: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#8c9bab] gap-3">
        <Clock size={24} className="animate-spin text-[#579dff]" />
        <span className="text-xs">{t('common.loading')}</span>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="p-6 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          <AlertCircle size={24} className="mb-2" />
          <h3 className="text-sm font-bold mb-1">{t('common.error')}</h3>
          <p>{error || 'Issue not found'}</p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#22273b] hover:bg-[#2c334d] text-[#dfe1e6] font-semibold text-xs transition-colors"
          >
            {t('projects.backToProjects')}
          </Link>
        </div>
      </div>
    );
  }

  const currentTagIds = (issue.tags || []).map((t) => t.id);
  const unassignedTags = allAvailableTags.filter((t) => !currentTagIds.includes(t.id));

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#22273b] select-none">
        <div className="flex items-center gap-1.5 text-xs text-[#8c9bab]">
          <Link to="/" className="hover:text-[#579dff] transition-colors">
            {t('nav.projects')}
          </Link>
          <ChevronRight size={12} />
          <Link
            to={`/projects/${issue.project_id}`}
            className="hover:text-[#579dff] transition-colors"
          >
            {issue.project_name || t('common.project')}
          </Link>
          <ChevronRight size={12} />
          <span className="font-mono text-[#579dff] font-semibold">ALPHA-{issue.id}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${issue.project_id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161a23] hover:bg-[#1f2638] border border-[#262c3f] text-xs font-semibold text-[#dfe1e6] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>{t('issueDetail.backToBoard')}</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Edit3 size={13} />
            <span>{t('issueDetail.editIssue')}</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteIssue}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>{t('common.delete')}</span>
          </button>
        </div>
      </div>

      {/* Jira 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Main Issue Body & Comments / Activity */}
        <div className="lg:col-span-8 space-y-6">
          {/* Issue Header */}
          <div className="group">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
              <span className="font-mono text-xs font-semibold text-[#8c9bab]">
                ALPHA-{issue.id}
              </span>

              {/* Requirement Traceability Pill in Task Header */}
              {issue.requirements && issue.requirements.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  {issue.requirements.map((req) => (
                    <span
                      key={req.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${
                        req.type === 'FR'
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          : req.type === 'NFR'
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      }`}
                      title={`${req.code}: ${req.title} (${req.category})`}
                    >
                      <Target size={11} className="text-[#579dff]" />
                      <span className="font-mono">{req.code}</span>
                      <span className="text-[10px] uppercase font-mono px-1 rounded bg-black/40">
                        {req.type}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-[#dfe1e6] tracking-tight leading-snug flex-1">
                {issue.title}
              </h1>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="p-1.5 rounded hover:bg-[#22273b] text-[#8c9bab] hover:text-[#579dff] transition-all cursor-pointer"
                title={t('issueDetail.editSummaryDetails')}
              >
                <Edit3 size={15} />
              </button>
            </div>
          </div>

          {/* Description Block */}
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-5 shadow-sm group">
            <div className="flex items-center justify-between mb-2.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-[#9fadbc]">
                {t('issueDetail.description')}
              </span>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-1 text-[11px] text-[#579dff] hover:underline cursor-pointer"
              >
                <Pencil size={11} />
                <span>{t('common.edit')}</span>
              </button>
            </div>
            <div className="text-xs text-[#dfe1e6] leading-relaxed whitespace-pre-wrap bg-[#0c1017] p-3.5 rounded-md border border-[#1e2333]">
              {issue.description || <em className="text-[#8c9bab]">{t('issueDetail.noDescription')}</em>}
            </div>
          </div>

          {/* State Transition Matrix Control */}
          <StateTransitionControl
            currentStatus={issue.status}
            allowedTransitions={issue.allowed_transitions}
            onTransition={handleTransition}
            loading={actionLoading}
          />

          {/* Activity / Comments Feed Section */}
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-5 shadow-sm">
            {/* Tabs Header */}
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#22273b] select-none">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'comments'
                      ? 'bg-[#0c66e4]/20 text-[#579dff] border border-[#0c66e4]/30'
                      : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
                  }`}
                >
                  <MessageSquare size={14} />
                  <span>{t('issueDetail.tabsComments')} ({comments.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-[#0c66e4]/20 text-[#579dff] border border-[#0c66e4]/30'
                      : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
                  }`}
                >
                  <History size={14} />
                  <span>{t('issueDetail.tabsHistory')} ({activities.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('worklogs')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'worklogs'
                      ? 'bg-[#0c66e4]/20 text-[#579dff] border border-[#0c66e4]/30'
                      : 'text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1a202e]'
                  }`}
                >
                  <Clock size={14} />
                  <span>{t('issueDetail.tabsWorkLogs')} ({timeLogs.length})</span>
                </button>
              </div>

              <span className="text-[11px] text-[#8c9bab]">
                {activeTab === 'comments' ? t('issueDetail.peerDiscussion') : t('issueDetail.auditTrail')}
              </span>
            </div>

            {/* TAB 1: COMMENTS */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                {/* Comment List */}
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <p className="text-xs text-[#8c9bab] italic py-2">
                      {t('issueDetail.noComments')}
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="bg-[#121622] border border-[#22273b] hover:border-[#2e374f] rounded-lg p-3.5 transition-colors shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/30 text-[10px] font-bold text-indigo-300 flex items-center justify-center">
                              {getInitials(c.author)}
                            </div>
                            <strong className="text-xs font-semibold text-[#dfe1e6]">
                              {c.author}
                            </strong>
                            <span className="text-[11px] text-[#8c9bab]">
                              {new Date(c.created_at).toLocaleString()}
                            </span>
                            {c.updated_at && c.updated_at !== c.created_at && (
                              <span className="text-[10px] text-[#626f86] italic">
                                {t('issueDetail.edited')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditComment(c)}
                              className="p-1 text-[#8c9bab] hover:text-[#579dff] hover:bg-[#0c66e4]/10 rounded transition-colors"
                              title={t('issueDetail.editComment')}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              className="p-1 text-[#8c9bab] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title={t('issueDetail.deleteComment')}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {editingCommentId === c.id ? (
                          <div className="pl-7 pt-1 space-y-2">
                            <textarea
                              value={editingCommentContent}
                              onChange={(e) => setEditingCommentContent(e.target.value)}
                              rows={3}
                              className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2 outline-none font-sans"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={commentUpdating}
                                onClick={() => handleSaveEditComment(c.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <Check size={11} />
                                <span>{commentUpdating ? t('common.saving') : t('common.save')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditComment}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1e2433] hover:bg-[#283044] text-[#8c9bab] hover:text-[#dfe1e6] text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                <X size={11} />
                                <span>{t('common.cancel')}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-[#dfe1e6] leading-relaxed whitespace-pre-wrap pl-7">
                            {c.content}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input Form */}
                <form onSubmit={handleAddComment} className="pt-4 border-t border-[#22273b] space-y-3">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#9fadbc]">
                    {t('issueDetail.addComment')}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-1">
                      <input
                        type="text"
                        placeholder={t('issueDetail.author')}
                        value={commentAuthor}
                        onChange={(e) => setCommentAuthor(e.target.value)}
                        required
                        className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder={t('issueDetail.writeComment')}
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        required
                        className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md p-2 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={commentSubmitting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send size={13} />
                      <span>{commentSubmitting ? t('common.saving') : t('issueDetail.postComment')}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: AUDIT LOG TIMELINE */}
            {activeTab === 'history' && (
              <ActivityTimeline activities={activities} />
            )}

            {/* TAB 3: WORK LOGS */}
            {activeTab === 'worklogs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#22273b]">
                  <div className="text-xs text-[#8c9bab]">
                    {t('issueDetail.totalTimeLogged')} <strong className="text-emerald-400 font-mono">{issue.logged_hours || 0}h</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLogWorkOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Clock size={12} />
                    <span>+ {t('issueDetail.logWork')}</span>
                  </button>
                </div>

                {timeLogs.length === 0 ? (
                  <p className="text-xs text-[#8c9bab] italic py-4 text-center">
                    {t('issueDetail.noWorklogsPrompt')}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {timeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-[#121622] border border-[#22273b] hover:border-[#2e374f] rounded-lg p-3.5 flex items-start justify-between text-xs transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {getInitials(log.author)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-[#dfe1e6]">{log.author}</strong>
                              <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 text-[11px]">
                                {t('issueDetail.hoursSpent', { hours: log.hours_spent })}
                              </span>
                              <span className="text-[11px] text-[#8c9bab]">
                                {t('issueDetail.onDate', { date: log.log_date })}
                              </span>
                            </div>
                            <p className="text-[#8c9bab] mt-1 leading-relaxed">
                              {log.description || t('issueDetail.noNotes')}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTimeLog(log.id)}
                          className="p-1 text-[#8c9bab] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                          title={t('common.delete')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Jira Metadata Sidebar Panel */}
        <div className="lg:col-span-4 space-y-5">
          {/* Details Card */}
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-4 shadow-sm select-none">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9fadbc] pb-3 mb-3 border-b border-[#22273b]">
              {t('issueDetail.details')}
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* Status with Quick Transition Dropdown */}
              <div className="flex items-center justify-between relative">
                <span className="text-[#8c9bab]">{t('issueDetail.status')}</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusDropdown((prev) => !prev);
                      setShowPriorityDropdown(false);
                      setShowAssigneeDropdown(false);
                      setShowReporterDropdown(false);
                    }}
                    className="flex items-center gap-1 hover:ring-1 hover:ring-[#579dff] rounded transition-all cursor-pointer p-0.5 group"
                    title="Click to transition issue status"
                  >
                    <StatusBadge status={issue.status} />
                    <ChevronDown size={11} className="text-[#8c9bab] group-hover:text-[#579dff] transition-colors" />
                  </button>

                  {showStatusDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#181d28] border border-[#2e374f] rounded-lg shadow-2xl py-1 z-30">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-[#626f86] border-b border-[#22273b]">
                        {t('issueDetail.moveIssueStatus')}
                      </div>
                      {issue.allowed_transitions && issue.allowed_transitions.length > 0 ? (
                        issue.allowed_transitions.map((target) => (
                          <button
                            key={target}
                            type="button"
                            onClick={() => {
                              setShowStatusDropdown(false);
                              handleTransition(target);
                            }}
                            className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[#202738] transition-colors cursor-pointer"
                          >
                            <span className="capitalize text-[#dfe1e6]">{t('issueDetail.moveTo')} {target.replace('-', ' ')}</span>
                            <StatusBadge status={target} />
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-[11px] text-[#8c9bab] italic">
                          {t('issueDetail.noTransitionsAllowed')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Priority with Quick Dropdown */}
              <div className="flex items-center justify-between relative">
                <span className="text-[#8c9bab]">{t('issueDetail.priority')}</span>
                <div className="relative">
                  <button
                    type="button"
                    disabled={priorityUpdating}
                    onClick={() => {
                      setShowPriorityDropdown((prev) => !prev);
                      setShowStatusDropdown(false);
                      setShowAssigneeDropdown(false);
                      setShowReporterDropdown(false);
                    }}
                    className="flex items-center gap-1 hover:ring-1 hover:ring-[#579dff] rounded transition-all cursor-pointer p-0.5 group"
                    title="Click to change Priority"
                  >
                    <PriorityBadge priority={issue.priority} />
                    <ChevronDown size={11} className="text-[#8c9bab] group-hover:text-[#579dff] transition-colors" />
                  </button>

                  {showPriorityDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#181d28] border border-[#2e374f] rounded-lg shadow-2xl py-1 z-30">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-[#626f86] border-b border-[#22273b]">
                        {t('issueDetail.setPriority')}
                      </div>
                      {[
                        { id: 'critical', label: t('priority.critical') },
                        { id: 'high', label: t('priority.high') },
                        { id: 'medium', label: t('priority.medium') },
                        { id: 'low', label: t('priority.low') },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleQuickUpdatePriority(p.id)}
                          className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[#202738] transition-colors cursor-pointer ${
                            issue.priority?.toLowerCase() === p.id ? 'bg-[#0c66e4]/15' : ''
                          }`}
                        >
                          <PriorityBadge priority={p.id} />
                          {issue.priority?.toLowerCase() === p.id && (
                            <Check size={12} className="text-[#579dff]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignee with Quick Dropdown */}
              <div className="flex items-center justify-between relative">
                <span className="text-[#8c9bab]">{t('issueDetail.assignee')}</span>
                <div className="relative">
                  <button
                    type="button"
                    disabled={assigneeUpdating}
                    onClick={() => {
                      setShowAssigneeDropdown((prev) => !prev);
                      setShowStatusDropdown(false);
                      setShowPriorityDropdown(false);
                      setShowReporterDropdown(false);
                    }}
                    className="flex items-center gap-1.5 font-medium text-[#dfe1e6] hover:bg-[#22273b] px-2 py-1 rounded transition-colors cursor-pointer border border-transparent hover:border-[#2e374f] group"
                    title="Click to reassign member"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#22273b] border border-[#2e374f] text-[9px] font-bold text-[#dfe1e6] flex items-center justify-center">
                      {getInitials(issue.assignee)}
                    </div>
                    <span>{issue.assignee || t('issueDetail.unassigned')}</span>
                    <ChevronDown size={11} className="text-[#8c9bab] group-hover:text-[#579dff] transition-colors" />
                  </button>

                  {showAssigneeDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#181d28] border border-[#2e374f] rounded-lg shadow-2xl py-1 z-30 max-h-64 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-[#626f86] border-b border-[#22273b] flex items-center justify-between">
                        <span>{t('issueDetail.assignTo')}</span>
                        {user?.name && user.name !== issue.assignee && (
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateAssignee(user.name)}
                            className="text-[#579dff] hover:underline normal-case text-[10px] flex items-center gap-0.5 cursor-pointer font-normal"
                          >
                            <Sparkles size={10} /> {t('issueDetail.assignToMe')}
                          </button>
                        )}
                      </div>

                      {/* Unassign option */}
                      <button
                        type="button"
                        onClick={() => handleQuickUpdateAssignee(null)}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-[#202738] transition-colors cursor-pointer ${
                          !issue.assignee ? 'bg-[#0c66e4]/15 text-[#579dff] font-semibold' : 'text-[#8c9bab]'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-[#1e2333] border border-[#2e374f] text-[9px] flex items-center justify-center">
                          ?
                        </div>
                        <span>{t('issueDetail.unassigned')}</span>
                      </button>

                      {/* Project Members */}
                      {projectMembers.map((m) => {
                        const isSelected = issue.assignee === m.name;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleQuickUpdateAssignee(m.name)}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[#202738] transition-colors cursor-pointer ${
                              isSelected ? 'bg-[#0c66e4]/15 font-semibold' : 'text-[#dfe1e6]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`}
                                alt={m.name}
                                className="w-5 h-5 rounded-full bg-[#1e2333]"
                              />
                              <div>
                                <div className="leading-tight">{m.name}</div>
                                <div className="text-[10px] text-[#8c9bab]">{m.role || 'Member'}</div>
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-[#579dff]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Reporter with Quick Dropdown */}
              <div className="flex items-center justify-between relative">
                <span className="text-[#8c9bab]">{t('issueDetail.reporter')}</span>
                <div className="relative">
                  <button
                    type="button"
                    disabled={reporterUpdating}
                    onClick={() => {
                      setShowReporterDropdown((prev) => !prev);
                      setShowStatusDropdown(false);
                      setShowPriorityDropdown(false);
                      setShowAssigneeDropdown(false);
                    }}
                    className="flex items-center gap-1.5 font-medium text-[#dfe1e6] hover:bg-[#22273b] px-2 py-1 rounded transition-colors cursor-pointer border border-transparent hover:border-[#2e374f] group"
                    title="Click to reassign reporter"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/30 text-[9px] font-bold text-indigo-300 flex items-center justify-center">
                      {getInitials(issue.creator)}
                    </div>
                    <span>{issue.creator}</span>
                    <ChevronDown size={11} className="text-[#8c9bab] group-hover:text-[#579dff] transition-colors" />
                  </button>

                  {showReporterDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#181d28] border border-[#2e374f] rounded-lg shadow-2xl py-1 z-30 max-h-64 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-[#626f86] border-b border-[#22273b]">
                        {t('issueDetail.changeReporter')}
                      </div>
                      {projectMembers.map((m) => {
                        const isSelected = issue.creator === m.name;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleQuickUpdateReporter(m.name)}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[#202738] transition-colors cursor-pointer ${
                              isSelected ? 'bg-[#0c66e4]/15 font-semibold' : 'text-[#dfe1e6]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`}
                                alt={m.name}
                                className="w-5 h-5 rounded-full bg-[#1e2333]"
                              />
                              <div>
                                <div className="leading-tight">{m.name}</div>
                                <div className="text-[10px] text-[#8c9bab]">{m.role || 'Member'}</div>
                              </div>
                            </div>
                            {isSelected && <Check size={12} className="text-[#579dff]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Labels / Tags */}
              <div className="pt-2 border-t border-[#22273b]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#8c9bab] flex items-center gap-1">
                    <Tag size={12} className="text-[#579dff]" /> {t('issueDetail.tags')}:
                  </span>
                  {unassignedTags.length > 0 && (
                    <select
                      className="bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-[11px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddTag(Number(e.target.value));
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>{t('issueDetail.addLabel')}</option>
                      {unassignedTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {(issue.tags || []).length === 0 ? (
                    <span className="text-[11px] text-[#8c9bab] italic">{t('issueDetail.none')}</span>
                  ) : (
                    issue.tags.map((t) => (
                      <TagBadge key={t.id} tag={t} onRemove={handleRemoveTag} />
                    ))
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="pt-2 border-t border-[#22273b] space-y-1.5 text-[11px] text-[#8c9bab]">
                <div className="flex items-center justify-between">
                  <span>{t('issueDetail.created')}</span>
                  <span className="text-[#dfe1e6]">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('issueDetail.updated')}</span>
                  <span className="text-[#dfe1e6]">
                    {new Date(issue.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements & Architecture (RETM) Traceability Card */}
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-4 shadow-sm select-none">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22273b]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9fadbc] flex items-center gap-1.5">
                <Target size={13} className="text-[#579dff]" />
                <span>តម្រូវការ & ស្ថាបត្យកម្ម (RETM)</span>
              </h3>
              <Link
                to={`/projects/${issue.project_id}`}
                className="text-[11px] font-semibold text-[#579dff] hover:underline"
              >
                មើល Matrix →
              </Link>
            </div>

            {issue.requirements && issue.requirements.length > 0 ? (
              <div className="space-y-2">
                {issue.requirements.map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-lg bg-[#0c1017] border border-[#2e374f] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-[#579dff]">
                        {req.code}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          req.type === 'FR'
                            ? 'bg-sky-500/20 text-sky-300'
                            : req.type === 'NFR'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {req.type} • {req.category}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#dfe1e6]">
                      {req.title}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#8c9bab] italic">
                មិនទាន់មាន Requirement ភ្ជាប់ (Unlinked)
              </div>
            )}
          </div>

          {/* Time Tracking & Schedule Card */}
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-4 shadow-sm select-none">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22273b]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9fadbc] flex items-center gap-1.5">
                <Clock size={13} className="text-[#579dff]" />
                <span>{t('issueDetail.timeTrackingSchedule')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsLogWorkOpen(true)}
                className="text-[11px] font-semibold text-[#579dff] hover:underline flex items-center gap-1 cursor-pointer"
              >
                + {t('issueDetail.logWork')}
              </button>
            </div>

            {/* Progress Gauge */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5 font-mono text-[11px]">
                  <span className="text-[#8c9bab]">
                    {t('issueDetail.loggedOf', { logged: issue.logged_hours || 0, est: issue.estimated_hours || 8 })}
                  </span>
                  <span className="font-bold text-[#579dff]">{issue.progress || 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#0c1017] border border-[#22273b] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, issue.progress || 0)}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-[#0c66e4] to-[#579dff] transition-all"
                  />
                </div>
              </div>

              {/* Start & Due Date */}
              <div className="pt-2 border-t border-[#22273b] space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#8c9bab]">{t('issueDetail.plannedStart')}</span>
                  <span className="text-[#dfe1e6]">{issue.start_date || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8c9bab]">{t('issueDetail.plannedDue')}</span>
                  <span className="text-[#dfe1e6]">{issue.due_date || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8c9bab]">{t('issueDetail.estimatedHours')}</span>
                  <span className="text-[#dfe1e6]">{issue.estimated_hours || 8} hrs</span>
                </div>
              </div>
            </div>
          </div>

          {/* ITPM Task Dependencies Card (FS, SS, FF, SF) */}
          <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-4 shadow-sm select-none">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22273b]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9fadbc] flex items-center gap-1.5">
                <Link2 size={13} className="text-[#579dff]" />
                <span>{t('issueDetail.itpmDeps')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(true)}
                className="text-[11px] font-semibold text-[#579dff] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {t('issueDetail.linkNewTask')}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Predecessors */}
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8c9bab] tracking-wider block mb-1.5">
                  {t('issueDetail.predecessors')}
                </span>
                {(dependencies.predecessors || []).length === 0 ? (
                  <span className="text-[11px] text-[#8c9bab] italic block">{t('issueDetail.noPredecessors')}</span>
                ) : (
                  <div className="space-y-1.5">
                    {dependencies.predecessors.map((p) => (
                      <div
                        key={p.dependency_id}
                        className="p-2 rounded-lg bg-[#11151f] border border-[#22273b] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400">
                            {p.type}
                          </span>
                          <Link
                            to={`/issues/${p.issue_id}`}
                            className="text-[#dfe1e6] hover:text-[#579dff] truncate font-medium text-[11px]"
                          >
                            ALPHA-{p.issue_id}: {p.title}
                          </Link>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(t('issueDetail.deleteDepConfirm'))) return;
                            await api.deleteDependency(p.dependency_id);
                            fetchIssueAndData();
                            refreshActivities();
                          }}
                          className="text-[#8c9bab] hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title={t('common.delete')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Successors */}
              <div className="pt-2 border-t border-[#22273b]">
                <span className="text-[10px] uppercase font-bold text-[#8c9bab] tracking-wider block mb-1.5">
                  {t('issueDetail.successors')}
                </span>
                {(dependencies.successors || []).length === 0 ? (
                  <span className="text-[11px] text-[#8c9bab] italic block">{t('issueDetail.noSuccessors')}</span>
                ) : (
                  <div className="space-y-1.5">
                    {dependencies.successors.map((s) => (
                      <div
                        key={s.dependency_id}
                        className="p-2 rounded-lg bg-[#11151f] border border-[#22273b] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-400">
                            {s.type}
                          </span>
                          <Link
                            to={`/issues/${s.issue_id}`}
                            className="text-[#dfe1e6] hover:text-[#579dff] truncate font-medium text-[11px]"
                          >
                            ALPHA-{s.issue_id}: {s.title}
                          </Link>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(t('issueDetail.deleteDepConfirm'))) return;
                            await api.deleteDependency(s.dependency_id);
                            fetchIssueAndData();
                            refreshActivities();
                          }}
                          className="text-[#8c9bab] hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title={t('common.delete')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Invisible backdrop to dismiss Details popover menus */}
      {(showPriorityDropdown || showAssigneeDropdown || showReporterDropdown || showStatusDropdown) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setShowPriorityDropdown(false);
            setShowAssigneeDropdown(false);
            setShowReporterDropdown(false);
            setShowStatusDropdown(false);
          }}
        />
      )}

      {/* Edit Issue Modal */}
      <EditIssueModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        issue={issue}
        projectId={issue.project_id}
        onIssueUpdated={(updated) => {
          setIssue((prev) => ({ ...prev, ...updated }));
          refreshActivities();
        }}
      />

      {/* Log Work Modal */}
      <LogWorkModal
        isOpen={isLogWorkOpen}
        onClose={() => setIsLogWorkOpen(false)}
        issueId={issue.id}
        projectId={issue.project_id}
        initialIssue={issue}
        onWorkLogged={() => {
          fetchIssueAndData();
          refreshActivities();
        }}
      />

      {/* ITPM Task Dependencies Modal */}
      <LinkTaskModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        projectId={issue.project_id}
        issues={projectIssues.length > 0 ? projectIssues : [issue]}
        dependencies={allProjectDeps}
        onDependencyChanged={() => {
          fetchIssueAndData();
          refreshActivities();
        }}
      />
    </div>
  );
}

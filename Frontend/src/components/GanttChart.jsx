import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge } from './PriorityBadge.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { LinkTaskModal } from './LinkTaskModal.jsx';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Diamond,
  User,
  Sliders,
  Maximize2,
  Link2,
  GitCommit,
  Eye,
  EyeOff,
  Trash2,
  Info,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Columns,
} from 'lucide-react';

const ROW_HEIGHT = 44; // h-11 in pixels

function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function GanttChart({
  issues = [],
  projectId,
  onIssueUpdated,
  onOpenCreateModal,
}) {
  const { t } = useLanguage();
  const [zoomMode, setZoomMode] = useState('days'); // 'days' | 'weeks'
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dependency Management State
  const [dependencies, setDependencies] = useState([]);
  const [showDependencies, setShowDependencies] = useState(true);
  const [depTypeFilter, setDepTypeFilter] = useState('all'); // 'all' | 'FS' | 'SS' | 'FF' | 'SF'
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [hoveredDepId, setHoveredDepId] = useState(null);
  const [loadingDeps, setLoadingDeps] = useState(false);

  // Responsive UI: Collapsible Task Table
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);

  // Interactive Drag & Drop / Click-to-Connect Linking State
  const [dragConnecting, setDragConnecting] = useState(null);
  const [dropPopover, setDropPopover] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);

  // Canvas and Timeline Container Refs for accurate coordinate translation
  const timelineContainerRef = useRef(null);
  const timelineCanvasRef = useRef(null);

  // Fetch project dependencies
  const fetchDependencies = async () => {
    if (!projectId) return;
    setLoadingDeps(true);
    try {
      const res = await api.getProjectDependencies(projectId);
      setDependencies(res.data || []);
    } catch (err) {
      console.warn('Could not load dependencies:', err.message);
    } finally {
      setLoadingDeps(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, [projectId]);

  // 1. Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      const matchAssignee =
        selectedAssignee === 'all' ||
        (selectedAssignee === 'unassigned' && !i.assignee) ||
        (i.assignee && i.assignee.toLowerCase() === selectedAssignee.toLowerCase());
      const matchSearch =
        !searchTerm ||
        i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `ALPHA-${i.id}`.toLowerCase().includes(searchTerm.toLowerCase());
      return matchAssignee && matchSearch;
    });
  }, [issues, selectedAssignee, searchTerm]);

  // Map issue id -> row index in filtered list for SVG coordinates
  const rowIndexMap = useMemo(() => {
    const map = new Map();
    filteredIssues.forEach((issue, idx) => {
      map.set(Number(issue.id), idx);
    });
    return map;
  }, [filteredIssues]);

  // Filter dependencies to only those currently visible in issues list and matching type
  const visibleDependencies = useMemo(() => {
    if (!showDependencies) return [];
    return dependencies.filter((dep) => {
      const predVisible = rowIndexMap.has(Number(dep.predecessor_id));
      const succVisible = rowIndexMap.has(Number(dep.successor_id));
      const typeMatch = depTypeFilter === 'all' || dep.type === depTypeFilter;
      return predVisible && succVisible && typeMatch;
    });
  }, [dependencies, showDependencies, depTypeFilter, rowIndexMap]);

  // Unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const set = new Set();
    issues.forEach((i) => {
      if (i.assignee) set.add(i.assignee);
    });
    return Array.from(set);
  }, [issues]);

  // 2. Compute timeline date boundaries
  const { minDate, maxDate, totalDays, dateList } = useMemo(() => {
    const now = new Date();
    let min = new Date(now);
    let max = new Date(now.getTime() + 21 * 24 * 3600 * 1000);

    issues.forEach((i) => {
      if (i.start_date) {
        const s = new Date(i.start_date);
        if (s < min) min = s;
      }
      if (i.due_date) {
        const d = new Date(i.due_date);
        if (d > max) max = d;
      }
    });

    // Pad start by -2 days, end by +5 days
    min = new Date(min.getTime() - 2 * 24 * 3600 * 1000);
    max = new Date(max.getTime() + 5 * 24 * 3600 * 1000);

    const diffDays = Math.ceil((max - min) / (1000 * 60 * 60 * 24)) + 1;
    const list = [];
    for (let d = 0; d < diffDays; d++) {
      const day = new Date(min.getTime() + d * 24 * 3600 * 1000);
      list.push(day);
    }

    return { minDate: min, maxDate: max, totalDays: diffDays, dateList: list };
  }, [issues]);

  // Column width per day
  const dayColWidth = zoomMode === 'days' ? 36 : 24;
  const timelineTotalWidth = totalDays * dayColWidth;
  const totalCanvasHeight = filteredIssues.length * ROW_HEIGHT;

  // Today marker offset
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffsetDays = Math.floor((today - minDate) / (1000 * 60 * 60 * 24));
  const todayLeftPx = todayOffsetDays * dayColWidth + dayColWidth / 2;

  // Calculate position & width for an issue bar
  const getBarLayout = (issue) => {
    const sDate = issue.start_date ? new Date(issue.start_date) : minDate;
    const dDate = issue.due_date ? new Date(issue.due_date) : new Date(sDate.getTime() + 7 * 24 * 3600 * 1000);

    const startOffset = Math.max(0, Math.floor((sDate - minDate) / (1000 * 60 * 60 * 24)));
    const duration = Math.max(1, Math.ceil((dDate - sDate) / (1000 * 60 * 60 * 24)) + 1);

    const left = startOffset * dayColWidth;
    const width = Math.max(dayColWidth, duration * dayColWidth);
    const right = left + width;

    const rowIdx = rowIndexMap.get(Number(issue.id)) ?? 0;
    const top = rowIdx * ROW_HEIGHT + 8;
    const centerY = rowIdx * ROW_HEIGHT + 22;

    return { left, width, right, duration, top, centerY, rowIdx };
  };

  // Helper to get issue by id
  const getIssueById = (id) => issues.find((i) => Number(i.id) === Number(id));

  // Compute SVG Path Geometry for the 4 ITPM Relationship Types
  const getDependencyPathData = (dep) => {
    const predIssue = getIssueById(dep.predecessor_id);
    const succIssue = getIssueById(dep.successor_id);
    if (!predIssue || !succIssue) return null;

    const pLayout = getBarLayout(predIssue);
    const sLayout = getBarLayout(succIssue);

    const x1_right = pLayout.right;
    const x1_left = pLayout.left;
    const y1 = pLayout.centerY;

    const x2_left = sLayout.left;
    const x2_right = sLayout.right;
    const y2 = sLayout.centerY;

    let path = '';
    let mid = { x: 0, y: 0 };
    let markerId = `arrow-${dep.type.toLowerCase()}`;

    if (dep.is_conflict) {
      markerId = 'arrow-conflict';
    }

    switch (dep.type) {
      case 'FS': {
        // Finish-to-Start: Predecessor right edge -> Successor left edge
        if (x2_left >= x1_right + 16) {
          const midX = (x1_right + x2_left) / 2;
          path = `M ${x1_right} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2_left} ${y2}`;
          mid = { x: midX, y: (y1 + y2) / 2 };
        } else {
          const rX = x1_right + 12;
          const lX = x2_left - 14;
          const midY = (y1 + y2) / 2;
          path = `M ${x1_right} ${y1} H ${rX} V ${midY} H ${lX} V ${y2} H ${x2_left}`;
          mid = { x: lX, y: midY };
        }
        break;
      }
      case 'SS': {
        // Start-to-Start: Predecessor left edge -> Successor left edge
        const lX = Math.min(x1_left, x2_left) - 18;
        path = `M ${x1_left} ${y1} H ${lX} V ${y2} H ${x2_left}`;
        mid = { x: lX, y: (y1 + y2) / 2 };
        break;
      }
      case 'FF': {
        // Finish-to-Finish: Predecessor right edge -> Successor right edge
        const rX = Math.max(x1_right, x2_right) + 18;
        path = `M ${x1_right} ${y1} H ${rX} V ${y2} H ${x2_right}`;
        mid = { x: rX, y: (y1 + y2) / 2 };
        break;
      }
      case 'SF': {
        // Start-to-Finish: Predecessor left edge -> Successor right edge
        const lX = x1_left - 16;
        const rX = x2_right + 16;
        const midY = (y1 + y2) / 2;
        path = `M ${x1_left} ${y1} H ${lX} V ${midY} H ${rX} V ${y2} H ${x2_right}`;
        mid = { x: (lX + rX) / 2, y: midY };
        break;
      }
      default:
        break;
    }

    return { path, mid, markerId, predIssue, succIssue };
  };

  // Get color for dependency link
  const getDepColor = (dep) => {
    if (dep.is_conflict) return '#ef4444'; // Red for conflict
    switch (dep.type) {
      case 'FS':
        return '#3b82f6'; // Blue
      case 'SS':
        return '#10b981'; // Emerald
      case 'FF':
        return '#8b5cf6'; // Purple
      case 'SF':
        return '#f59e0b'; // Amber
      default:
        return '#64748b';
    }
  };

  const handleDeleteDependency = async (depId) => {
    try {
      await api.deleteDependency(depId);
      fetchDependencies();
      setToastNotification({
        type: 'success',
        message: 'Dependency link removed successfully.',
      });
      setTimeout(() => setToastNotification(null), 3000);
    } catch (err) {
      setToastNotification({
        type: 'error',
        message: `Could not delete dependency: ${err.message}`,
      });
      setTimeout(() => setToastNotification(null), 4000);
    }
  };

  // =========================================================================
  // DRAG & DROP / CLICK-TO-LINK LOGIC (DIRECT BAR & CONNECTOR INTERACTION)
  // =========================================================================
  const handleStartConnectorDrag = (e, issue, handleType) => {
    e.preventDefault();
    e.stopPropagation();

    if (!timelineCanvasRef.current) return;
    const canvasRect = timelineCanvasRef.current.getBoundingClientRect();
    const layout = getBarLayout(issue);

    const startX = handleType === 'start' ? layout.left : layout.right;
    const startY = layout.centerY;

    const currentX = e.clientX - canvasRect.left;
    const currentY = e.clientY - canvasRect.top;

    setDragConnecting({
      sourceIssue: issue,
      sourceHandle: handleType, // 'start' | 'finish'
      startX,
      startY,
      currentX,
      currentY,
      hoveredTargetIssue: null,
      hoveredTargetHandle: null,
    });
  };

  // Window-level mouse tracking during connector drag
  useEffect(() => {
    if (!dragConnecting) return;

    const handlePointerMove = (e) => {
      if (!timelineCanvasRef.current) return;
      const canvasRect = timelineCanvasRef.current.getBoundingClientRect();
      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;

      setDragConnecting((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX,
          currentY,
        };
      });
    };

    const handlePointerUp = (e) => {
      if (!dragConnecting || !timelineCanvasRef.current) {
        setDragConnecting(null);
        return;
      }

      const { sourceIssue, sourceHandle, hoveredTargetIssue, hoveredTargetHandle } = dragConnecting;

      if (hoveredTargetIssue && hoveredTargetIssue.id !== sourceIssue.id) {
        const sHandle = sourceHandle;
        const tHandle = hoveredTargetHandle || 'start';

        // Auto-infer ITPM relationship type based on handle ports
        let inferredType = 'FS';
        if (sHandle === 'finish' && tHandle === 'start') inferredType = 'FS';
        else if (sHandle === 'start' && tHandle === 'start') inferredType = 'SS';
        else if (sHandle === 'finish' && tHandle === 'finish') inferredType = 'FF';
        else if (sHandle === 'start' && tHandle === 'finish') inferredType = 'SF';

        // Open viewport-centered modal dialog
        setDropPopover({
          isOpen: true,
          sourceIssue,
          targetIssue: hoveredTargetIssue,
          sourceHandle: sHandle,
          targetHandle: tHandle,
          inferredType,
          selectedType: inferredType,
          lagDays: 0,
        });
      }

      setDragConnecting(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragConnecting, timelineTotalWidth]);

  // Confirm and execute the link from Drag & Drop popover
  const handleConfirmDropLink = async () => {
    if (!dropPopover) return;
    const { sourceIssue, targetIssue, selectedType, lagDays } = dropPopover;
    setDropPopover(null);

    try {
      await api.createDependency(projectId, {
        predecessor_id: sourceIssue.id,
        successor_id: targetIssue.id,
        type: selectedType,
        lag_days: parseInt(lagDays, 10) || 0,
      });

      await fetchDependencies();
      if (onIssueUpdated) onIssueUpdated();

      setToastNotification({
        type: 'success',
        message: `Successfully linked ALPHA-${sourceIssue.id} ➔ ALPHA-${targetIssue.id} (${selectedType})!`,
      });
      setTimeout(() => setToastNotification(null), 3500);
    } catch (err) {
      setToastNotification({
        type: 'error',
        message: err.message || 'Failed to create dependency link.',
      });
      setTimeout(() => setToastNotification(null), 5000);
    }
  };

  return (
    <div className="bg-[#121622] border border-[#22273b] rounded-xl overflow-hidden shadow-xl select-none relative">
      {/* Toast Notification Strip */}
      {toastNotification && (
        <div
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
            toastNotification.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {toastNotification.type === 'error' ? (
            <AlertCircle size={15} className="text-rose-400" />
          ) : (
            <CheckCircle2 size={15} className="text-emerald-400" />
          )}
          <span>{toastNotification.message}</span>
        </div>
      )}

      {/* Top Controls Toolbar - Fully Responsive Grid/Flex */}
      <div className="p-3 sm:p-4 bg-[#161a23] border-b border-[#22273b] flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Side: Title & Badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#dfe1e6]">
            <Calendar size={15} className="text-[#579dff]" />
            <span>Gantt Timeline</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono">
            {filteredIssues.length} tasks
          </span>

          {/* Dependencies Count Badge */}
          <button
            type="button"
            onClick={() => setShowDependencies(!showDependencies)}
            className={`text-[11px] px-2 py-0.5 rounded-lg border font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              showDependencies
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                : 'bg-[#1e2333] border-[#2e374f] text-[#8c9bab]'
            }`}
            title="Toggle ITPM dependency link lines on Gantt canvas"
          >
            {showDependencies ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{t('gantt.links')} ({dependencies.length})</span>
          </button>
        </div>

        {/* Right Side: Filters, Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dependency Type Filter Selector */}
          {showDependencies && (
            <select
              value={depTypeFilter}
              onChange={(e) => setDepTypeFilter(e.target.value)}
              className="bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="all">{t('gantt.allTypes')}</option>
              <option value="FS">FS: Finish-to-Start</option>
              <option value="SS">SS: Start-to-Start</option>
              <option value="FF">FF: Finish-to-Finish</option>
              <option value="SF">SF: Start-to-Finish</option>
            </select>
          )}

          {/* Zoom Toggle */}
          <div className="inline-flex bg-[#0c1017] border border-[#2e374f] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setZoomMode('days')}
              className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                zoomMode === 'days' ? 'bg-[#1e2433] text-[#579dff]' : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              {t('gantt.zoomDays')}
            </button>
            <button
              type="button"
              onClick={() => setZoomMode('weeks')}
              className={`px-2 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                zoomMode === 'weeks' ? 'bg-[#1e2433] text-[#579dff]' : 'text-[#8c9bab] hover:text-[#dfe1e6]'
              }`}
            >
              {t('gantt.compact')}
            </button>
          </div>

          {/* Assignee Filter Dropdown */}
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-lg px-2 py-1 outline-none cursor-pointer max-w-[130px]"
          >
            <option value="all">{t('gantt.allAssignees')}</option>
            <option value="unassigned">{t('issueDetail.unassigned')}</option>
            {uniqueAssignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Search Input */}
          <input
            type="text"
            placeholder={t('gantt.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-lg px-2.5 py-1 outline-none placeholder-[#626f86] w-28 sm:w-32 focus:w-40 transition-all"
          />

          {/* Link Tasks Button (Preserved per User Request) */}
          <button
            type="button"
            onClick={() => setIsLinkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1e2433] hover:bg-[#283044] border border-[#3b4460] text-[#dfe1e6] text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            title="Manage and create task dependencies (FS, SS, FF, SF)"
          >
            <Link2 size={13} className="text-[#579dff]" />
            <span className="hidden sm:inline">{t('gantt.linkTasksBtn')}</span>
          </button>

          {/* Create Task Button */}
          {onOpenCreateModal && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">{t('gantt.schedule')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Gantt Split View Container */}
      <div className="flex overflow-x-auto min-h-[440px] max-h-[70vh]">
        {/* LEFT COLUMN: Collapsible & Responsive Fixed Task Data Grid Table */}
        {isTableCollapsed ? (
          /* Collapsed Left Bar */
          <div className="w-10 shrink-0 border-r border-[#22273b] bg-[#11151f] z-10 sticky left-0 shadow-lg flex flex-col items-center select-none">
            <button
              type="button"
              onClick={() => setIsTableCollapsed(false)}
              className="h-12 w-full flex items-center justify-center text-[#8c9bab] hover:text-[#579dff] hover:bg-[#161a23] border-b border-[#22273b] transition-colors cursor-pointer"
              title={t('gantt.expandGrid')}
            >
              <ChevronRight size={16} />
            </button>
            <div className="divide-y divide-[#1e2436] w-full">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="h-11 flex items-center justify-center font-mono text-[10px] font-bold text-[#579dff] hover:bg-[#181d2c] transition-colors cursor-pointer"
                  title={`ALPHA-${issue.id}: ${issue.title}`}
                  onClick={() => setIsTableCollapsed(false)}
                >
                  #{issue.id}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Expanded Responsive Left Table */
          <div className="w-[260px] sm:w-[290px] md:w-[320px] lg:w-[360px] shrink-0 border-r border-[#22273b] bg-[#11151f] z-10 sticky left-0 shadow-lg select-none">
            {/* Table Header */}
            <div className="h-12 bg-[#161a23] border-b border-[#22273b] px-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#9fadbc]">
              <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                <span className="w-14 shrink-0 font-mono">{t('gantt.key')}</span>
                <span className="truncate">{t('gantt.taskName')}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-right font-mono text-[10px]">
                <span className="w-10 text-center hidden sm:inline">{t('gantt.prog')}</span>
                <span className="w-8 text-right hidden sm:inline">{t('gantt.dur')}</span>
                <span className="w-12 text-right pr-1">{t('gantt.links')}</span>
                {/* Collapse Toggle */}
                <button
                  type="button"
                  onClick={() => setIsTableCollapsed(true)}
                  className="p-1 text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#202738] rounded transition-colors ml-0.5 cursor-pointer"
                  title={t('gantt.collapseGrid')}
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[#1e2436]">
              {filteredIssues.map((issue) => {
                const { duration } = getBarLayout(issue);

                // Find dependencies for this row
                const rowPreds = dependencies.filter((d) => Number(d.successor_id) === Number(issue.id));
                const rowSuccs = dependencies.filter((d) => Number(d.predecessor_id) === Number(issue.id));
                const hasConflict = rowPreds.some((d) => d.is_conflict) || rowSuccs.some((d) => d.is_conflict);

                return (
                  <div
                    key={issue.id}
                    className="h-11 px-2.5 flex items-center text-xs hover:bg-[#181d2c] transition-colors group justify-between"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                      <div className="w-14 shrink-0 font-mono text-[11px] font-semibold text-[#579dff] truncate">
                        <Link to={`/issues/${issue.id}`} className="hover:underline">
                          ALPHA-{issue.id}
                        </Link>
                      </div>
                      <div className="flex-1 truncate font-medium text-[#dfe1e6] text-[11px]">
                        <Link
                          to={`/issues/${issue.id}`}
                          className="hover:text-[#579dff] transition-colors"
                          title={issue.title}
                        >
                          {issue.title}
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-right font-mono text-[10px]">
                      <div className="w-10 text-center hidden sm:inline text-[#8c9bab]">
                        {issue.progress || 0}%
                      </div>
                      <div className="w-8 text-right hidden sm:inline text-[#8c9bab]">
                        {duration}d
                      </div>

                      {/* ITPM Links Column */}
                      <div className="w-12 flex items-center justify-end gap-1">
                        {hasConflict && (
                          <span title="Schedule Conflict detected!" className="text-rose-400">
                            <AlertTriangle size={12} />
                          </span>
                        )}

                        {rowPreds.length > 0 && (
                          <span
                            onClick={() => setIsLinkModalOpen(true)}
                            className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 cursor-pointer hover:bg-blue-500/20 text-[9px]"
                            title={`Predecessors: ${rowPreds.map((p) => `#${p.predecessor_id} (${p.type})`).join(', ')}`}
                          >
                            P:{rowPreds.length}
                          </span>
                        )}

                        {rowSuccs.length > 0 && (
                          <span
                            onClick={() => setIsLinkModalOpen(true)}
                            className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 cursor-pointer hover:bg-purple-500/20 text-[9px]"
                            title={`Successors: ${rowSuccs.map((s) => `#${s.successor_id} (${s.type})`).join(', ')}`}
                          >
                            S:{rowSuccs.length}
                          </span>
                        )}

                        {rowPreds.length === 0 && rowSuccs.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setIsLinkModalOpen(true)}
                            className="opacity-0 group-hover:opacity-100 text-[#8c9bab] hover:text-[#579dff] p-0.5 transition-opacity cursor-pointer"
                            title="Add dependency"
                          >
                            <Link2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: Interactive Gantt Timeline Canvas with SVG Dependency Overlay */}
        <div
          ref={timelineContainerRef}
          className="flex-1 overflow-x-auto relative bg-[#0c1017]"
        >
          <div
            ref={timelineCanvasRef}
            style={{ width: `${timelineTotalWidth}px` }}
            className="relative min-h-full"
          >
            {/* Timeline Header Row (Days / Dates) */}
            <div className="h-12 bg-[#161a23] border-b border-[#22273b] flex sticky top-0 z-20">
              {dateList.map((d, idx) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isFirstOfMonth = d.getDate() === 1 || idx === 0;
                const dayNum = d.getDate();
                const monthName = d.toLocaleString('default', { month: 'short' });

                return (
                  <div
                    key={idx}
                    style={{ width: `${dayColWidth}px` }}
                    className={`shrink-0 flex flex-col items-center justify-center border-r border-[#1e2333] text-[10px] select-none ${
                      isWeekend ? 'bg-[#121622]/80 text-[#626f86]' : 'text-[#8c9bab]'
                    }`}
                  >
                    {isFirstOfMonth ? (
                      <span className="text-[9px] font-bold text-[#579dff] uppercase leading-tight">
                        {monthName}
                      </span>
                    ) : null}
                    <span className="font-mono font-medium">{dayNum}</span>
                  </div>
                );
              })}
            </div>

            {/* Today Marker Line */}
            {todayOffsetDays >= 0 && todayOffsetDays < totalDays && (
              <div
                style={{ left: `${todayLeftPx}px` }}
                className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-30 pointer-events-none"
              >
                <div className="bg-rose-500 text-white text-[9px] font-bold px-1 rounded-b absolute -top-0 -left-4 font-mono shadow-sm">
                  {t('gantt.today')}
                </div>
              </div>
            )}

            {/* Background Vertical Grid Lines */}
            <div className="absolute inset-0 top-12 flex pointer-events-none z-0">
              {dateList.map((d, idx) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{ width: `${dayColWidth}px` }}
                    className={`shrink-0 border-r border-[#191f2e] ${
                      isWeekend ? 'bg-[#0f131d]/50' : ''
                    }`}
                  />
                );
              })}
            </div>

            {/* Task Horizontal Bars with Interactive Drag Ports */}
            <div className="divide-y divide-[#1e2436] relative z-10 pt-0">
              {filteredIssues.map((issue) => {
                const { left, width, duration } = getBarLayout(issue);
                const progressPct = issue.progress || 0;
                const isClosed = issue.status === 'closed';
                const isResolved = issue.status === 'resolved';

                // Bar Color Palette matching Jira & PM
                let barColor = 'from-[#0c66e4] to-[#0052cc]';
                let borderColor = 'border-[#2684ff]';
                let progressColor = 'bg-[#579dff]';

                if (isClosed || progressPct === 100) {
                  barColor = 'from-[#1f845a] to-[#22a06b]';
                  borderColor = 'border-[#4bce97]';
                  progressColor = 'bg-[#4bce97]';
                } else if (isResolved) {
                  barColor = 'from-[#8f4fbe] to-[#9b51e0]';
                  borderColor = 'border-[#c084fc]';
                  progressColor = 'bg-[#c084fc]';
                } else if (issue.status === 'open') {
                  barColor = 'from-[#44546f] to-[#2c3e50]';
                  borderColor = 'border-[#758195]';
                  progressColor = 'bg-[#8c9bab]';
                }

                // Check if this task has dependency conflict
                const hasTaskConflict = dependencies.some(
                  (d) =>
                    (Number(d.successor_id) === Number(issue.id) ||
                      Number(d.predecessor_id) === Number(issue.id)) &&
                    d.is_conflict
                );

                // Is this bar currently the target of active drag connection?
                const isDragTarget =
                  dragConnecting &&
                  dragConnecting.hoveredTargetIssue?.id === issue.id &&
                  dragConnecting.sourceIssue.id !== issue.id;

                const isDragSource =
                  dragConnecting && dragConnecting.sourceIssue.id === issue.id;

                return (
                  <div
                    key={issue.id}
                    className="h-11 relative flex items-center group"
                    onMouseEnter={() => {
                      if (dragConnecting && dragConnecting.sourceIssue.id !== issue.id) {
                        setDragConnecting((prev) => ({
                          ...prev,
                          hoveredTargetIssue: issue,
                          hoveredTargetHandle:
                            prev.currentX < left + width / 2 ? 'start' : 'finish',
                        }));
                      }
                    }}
                  >
                    {/* The Task Bar Element */}
                    <div
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                      }}
                      className={`absolute h-7 rounded-md bg-gradient-to-r ${barColor} border ${borderColor} shadow-md flex items-center px-2 transition-all ${
                        isDragTarget
                          ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-[#0c1017] scale-[1.02] shadow-xl'
                          : isDragSource
                          ? 'opacity-80 ring-2 ring-blue-400'
                          : 'hover:scale-[1.01]'
                      } group overflow-visible z-10`}
                    >
                      {/* Navigable Link Layer */}
                      <Link
                        to={`/issues/${issue.id}`}
                        className="absolute inset-0 z-0"
                        title={`ALPHA-${issue.id}: ${issue.title}\nSchedule: ${issue.start_date || 'N/A'} -> ${issue.due_date || 'N/A'} (${duration} days)\nProgress: ${progressPct}%\nAssignee: ${issue.assignee || 'Unassigned'}`}
                      />

                      {/* Inner Progress Fill Gauge */}
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="absolute inset-y-0 left-0 bg-white/20 transition-all pointer-events-none"
                      />

                      {/* Bar Labels & Title */}
                      <div className="relative z-10 flex items-center justify-between w-full text-white text-[11px] font-medium truncate pointer-events-none">
                        <span className="truncate pr-1 font-semibold flex items-center gap-1">
                          {hasTaskConflict && (
                            <AlertTriangle size={11} className="text-amber-300 animate-pulse shrink-0" />
                          )}
                          <span>{issue.title}</span>
                        </span>
                        <div className="flex items-center gap-1 text-[10px] shrink-0 font-mono">
                          {progressPct === 100 ? (
                            <CheckCircle2 size={12} className="text-white" />
                          ) : (
                            <span>{progressPct}%</span>
                          )}
                        </div>
                      </div>

                      {/* ========================================================
                          INTERACTIVE CONNECTOR PORTS / ANCHOR HANDLES
                          Left Port: START (for SS & SF links)
                          Right Port: FINISH (for FS & FF links)
                          ======================================================== */}
                      {/* START CONNECTOR PORT (LEFT) */}
                      <div
                        onPointerDown={(e) => handleStartConnectorDrag(e, issue, 'start')}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          if (dragConnecting && dragConnecting.sourceIssue.id !== issue.id) {
                            setDragConnecting((prev) => ({
                              ...prev,
                              hoveredTargetIssue: issue,
                              hoveredTargetHandle: 'start',
                            }));
                          }
                        }}
                        className={`absolute -left-2 top-1.5 w-4 h-4 rounded-full bg-white border-2 shadow-lg z-30 cursor-crosshair flex items-center justify-center transition-all ${
                          dragConnecting
                            ? 'opacity-100 scale-110'
                            : 'opacity-0 group-hover:opacity-100 scale-100 hover:scale-125'
                        } ${
                          isDragTarget && dragConnecting?.hoveredTargetHandle === 'start'
                            ? 'border-emerald-500 bg-emerald-100 scale-150 animate-ping'
                            : 'border-[#0c66e4]'
                        }`}
                        title="Start Port: Drag or click to connect (SS or SF)"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0c66e4]" />
                      </div>

                      {/* FINISH CONNECTOR PORT (RIGHT) */}
                      <div
                        onPointerDown={(e) => handleStartConnectorDrag(e, issue, 'finish')}
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          if (dragConnecting && dragConnecting.sourceIssue.id !== issue.id) {
                            setDragConnecting((prev) => ({
                              ...prev,
                              hoveredTargetIssue: issue,
                              hoveredTargetHandle: 'finish',
                            }));
                          }
                        }}
                        className={`absolute -right-2 top-1.5 w-4 h-4 rounded-full bg-white border-2 shadow-lg z-30 cursor-crosshair flex items-center justify-center transition-all ${
                          dragConnecting
                            ? 'opacity-100 scale-110'
                            : 'opacity-0 group-hover:opacity-100 scale-100 hover:scale-125'
                        } ${
                          isDragTarget && dragConnecting?.hoveredTargetHandle === 'finish'
                            ? 'border-emerald-500 bg-emerald-100 scale-150 animate-ping'
                            : 'border-[#0c66e4]'
                        }`}
                        title="Finish Port: Drag to link successor (FS or FF)"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0c66e4]" />
                      </div>
                    </div>

                    {/* Milestone Diamond Marker for 100% or Critical items */}
                    {issue.priority === 'critical' && (
                      <div
                        style={{ left: `${left + width + 8}px` }}
                        className="absolute flex items-center gap-1 text-rose-400 text-[10px] font-bold font-mono z-10"
                        title="Critical Milestone"
                      >
                        <Diamond size={11} className="fill-rose-500 text-rose-400 animate-pulse" />
                        <span className="hidden lg:inline">{issue.assignee || 'Critical'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ========================================================
                SVG DEPENDENCY ARROWS & LIVE DRAG RUBBER-BAND OVERLAY
                ======================================================== */}
            {showDependencies && (
              <svg
                style={{
                  position: 'absolute',
                  top: 48,
                  left: 0,
                  width: `${timelineTotalWidth}px`,
                  height: `${totalCanvasHeight}px`,
                  pointerEvents: 'none',
                  zIndex: 25,
                }}
              >
                <defs>
                  <marker
                    id="arrow-fs"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#3b82f6" />
                  </marker>

                  <marker
                    id="arrow-ss"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
                  </marker>

                  <marker
                    id="arrow-ff"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#8b5cf6" />
                  </marker>

                  <marker
                    id="arrow-sf"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#f59e0b" />
                  </marker>

                  <marker
                    id="arrow-conflict"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#ef4444" />
                  </marker>

                  <marker
                    id="arrow-drag"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Render Existing SVG Dependency Paths */}
                {visibleDependencies.map((dep) => {
                  const data = getDependencyPathData(dep);
                  if (!data) return null;

                  const color = getDepColor(dep);
                  const isHovered = hoveredDepId === dep.id;

                  return (
                    <g key={dep.id}>
                      {/* Wider invisible stroke for easy mouse hovering */}
                      <path
                        d={data.path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="12"
                        className="cursor-pointer"
                        style={{ pointerEvents: 'stroke' }}
                        onMouseEnter={() => setHoveredDepId(dep.id)}
                        onMouseLeave={() => setHoveredDepId(null)}
                      />

                      {/* Visible dependency path */}
                      <path
                        d={data.path}
                        fill="none"
                        stroke={color}
                        strokeWidth={isHovered ? 2.8 : 1.6}
                        strokeDasharray={dep.is_conflict ? '4 3' : 'none'}
                        markerEnd={`url(#${data.markerId})`}
                        className="transition-all duration-200"
                        style={{
                          filter: isHovered
                            ? `drop-shadow(0 0 4px ${color})`
                            : 'none',
                        }}
                      />

                      {/* Floating ITPM Tag at midpoint on hover or conflict */}
                      {(isHovered || dep.is_conflict) && (
                        <g
                          transform={`translate(${data.mid.x}, ${data.mid.y})`}
                          style={{ pointerEvents: 'auto' }}
                        >
                          <rect
                            x="-32"
                            y="-11"
                            width="64"
                            height="22"
                            rx="5"
                            fill={dep.is_conflict ? '#450a0a' : '#0f172a'}
                            stroke={color}
                            strokeWidth="1.2"
                            className="shadow-lg cursor-pointer"
                            onClick={() => setIsLinkModalOpen(true)}
                          />
                          <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            fill={color}
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                            className="pointer-events-none select-none"
                          >
                            {dep.type} {dep.lag_days !== 0 ? `+${dep.lag_days}d` : ''}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* REAL-TIME RUBBER-BAND LINE DURING ACTIVE DRAG-TO-LINK */}
                {dragConnecting && (
                  <g style={{ pointerEvents: 'none' }}>
                    <path
                      d={`M ${dragConnecting.startX} ${dragConnecting.startY - 48} C ${(dragConnecting.startX + dragConnecting.currentX) / 2} ${dragConnecting.startY - 48}, ${(dragConnecting.startX + dragConnecting.currentX) / 2} ${dragConnecting.currentY - 48}, ${dragConnecting.currentX} ${dragConnecting.currentY - 48}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      markerEnd="url(#arrow-drag)"
                      style={{
                        filter: 'drop-shadow(0 0 6px #38bdf8)',
                      }}
                    />
                    <circle
                      cx={dragConnecting.startX}
                      cy={dragConnecting.startY - 48}
                      r="4"
                      fill="#38bdf8"
                    />
                  </g>
                )}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info Strip with ITPM Legend & Drag Hint (Fully Responsive Flex-Wrap) */}
      <div className="p-3 bg-[#161a23] border-t border-[#22273b] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs text-[#8c9bab]">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
            <span className="text-[#dfe1e6]">FS (Finish-to-Start)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span className="text-[#dfe1e6]">SS (Start-to-Start)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
            <span className="text-[#dfe1e6]">FF (Finish-to-Finish)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[#dfe1e6]">SF (Start-to-Finish)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span className="text-rose-400">⚠️ {t('gantt.scheduleConflict')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-[#579dff] bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/25 max-w-full">
          <Sparkles size={12} className="shrink-0" />
          <span className="truncate">{t('gantt.dragTip')}</span>
        </div>
      </div>

      {/* FLOATING VIEWPORT-CENTERED DROP MODAL (Never clipped by scroll or container bounds) */}
      {dropPopover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setDropPopover(null)}
        >
          <div
            className="bg-[#161a23] border border-[#2e374f] rounded-2xl shadow-2xl p-5 w-full max-w-sm text-xs select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22273b]">
              <div className="flex items-center gap-2 font-bold text-[#dfe1e6] text-sm">
                <Sparkles size={16} className="text-[#579dff]" />
                <span>{t('gantt.confirmModalTitle')}</span>
              </div>
              <button
                type="button"
                onClick={() => setDropPopover(null)}
                className="text-[#8c9bab] hover:text-[#dfe1e6] p-1 rounded-lg hover:bg-[#202738] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Predecessor -> Successor Flow */}
            <div className="bg-[#11151f] p-3 rounded-xl border border-[#22273b] mb-3.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-[#dfe1e6] mb-1">
                <span className="text-[#579dff]">ALPHA-{dropPopover.sourceIssue.id}</span>
                <ArrowRight size={14} className="text-[#8c9bab]" />
                <span className="text-[#579dff]">ALPHA-{dropPopover.targetIssue.id}</span>
              </div>
              <div className="text-[11px] text-[#8c9bab] truncate">
                {dropPopover.sourceIssue.title} ➔ {dropPopover.targetIssue.title}
              </div>
            </div>

            {/* 4 ITPM Types Selector */}
            <div className="mb-3.5">
              <span className="text-[10px] font-bold uppercase text-[#8c9bab] tracking-wider block mb-1.5">
                {t('gantt.selectRelType')}
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {['FS', 'SS', 'FF', 'SF'].map((tType) => (
                  <button
                    key={tType}
                    type="button"
                    onClick={() =>
                      setDropPopover((prev) => ({
                        ...prev,
                        selectedType: tType,
                      }))
                    }
                    className={`py-2 rounded-xl font-mono font-bold text-xs border transition-all cursor-pointer ${
                      dropPopover.selectedType === tType
                        ? 'bg-[#0c66e4] text-white border-[#579dff] shadow-md scale-105'
                        : 'bg-[#11151f] text-[#8c9bab] border-[#22273b] hover:bg-[#1a2130]'
                    }`}
                  >
                    {tType}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-[#8c9bab] italic leading-tight">
                {dropPopover.selectedType === 'FS' && 'FS: Successor starts after predecessor finishes (Default).'}
                {dropPopover.selectedType === 'SS' && 'SS: Successor starts once predecessor starts.'}
                {dropPopover.selectedType === 'FF' && 'FF: Successor finishes once predecessor finishes.'}
                {dropPopover.selectedType === 'SF' && 'SF: Successor finishes once predecessor starts.'}
              </div>
            </div>

            {/* Lag buffer input */}
            <div className="flex items-center justify-between mb-5 bg-[#11151f] px-3.5 py-2 rounded-xl border border-[#22273b]">
              <span className="text-[11px] text-[#8c9bab]">{t('gantt.lagBuffer')}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={dropPopover.lagDays}
                  onChange={(e) =>
                    setDropPopover((prev) => ({
                      ...prev,
                      lagDays: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-16 text-center bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] rounded-lg py-1 text-xs font-mono outline-none"
                />
                <span className="text-[#8c9bab] text-[11px] font-mono">{t('gantt.days')}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDropPopover(null)}
                className="px-4 py-2 rounded-xl bg-[#1e2333] hover:bg-[#283044] text-[#8c9bab] text-xs font-semibold cursor-pointer transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDropLink}
                className="px-4 py-2 rounded-xl bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>{t('gantt.confirmLink')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Tasks Modal (Preserved as requested) */}
      <LinkTaskModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        projectId={projectId}
        issues={issues}
        dependencies={dependencies}
        onDependencyChanged={() => {
          fetchDependencies();
          if (onIssueUpdated) onIssueUpdated();
        }}
      />
    </div>
  );
}

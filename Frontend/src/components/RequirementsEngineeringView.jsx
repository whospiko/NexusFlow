import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  Layers,
  Shield,
  Zap,
  Scale,
  Smile,
  AlertTriangle,
  DollarSign,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Unlink,
  ArrowRight,
  RefreshCw,
  FileCheck,
  Check,
  X,
  Target,
  Users,
  Compass,
  Cpu,
  ListOrdered,
} from 'lucide-react';

export function RequirementsEngineeringView({ projectId, projectTasks = [] }) {
  const { t, language } = useLanguage();
  const [requirements, setRequirements] = useState([]);
  const [metrics, setMetrics] = useState({
    totalRequirements: 0,
    functionalCount: 0,
    nonFunctionalCount: 0,
    coveredCount: 0,
    validatedCount: 0,
    coveragePercentage: 0,
    validationPercentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable row details state
  const [expandedRows, setExpandedRows] = useState({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Quick link task dropdown state: reqId -> selected taskId
  const [taskToLink, setTaskToLink] = useState({});

  // Fetch requirements
  const fetchRequirements = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getProjectRequirements(projectId, {
        type: typeFilter,
        category: categoryFilter,
        status: statusFilter,
        search: searchQuery,
      });

      if (res.success) {
        const reqList = Array.isArray(res.data)
          ? res.data
          : (res.data?.requirements || res.requirements || []);
        const metricData = res.metrics || res.data?.metrics;
        setRequirements(reqList);
        if (metricData) {
          setMetrics(metricData);
        }
      } else {
        setError(res.message || 'Failed to load requirements');
      }
    } catch (err) {
      console.error('Error loading requirements:', err);
      setError(err.message || 'Failed to load requirements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchRequirements();
    }
  }, [projectId, typeFilter, categoryFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (projectId) {
        fetchRequirements();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleExpand = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Quick Task Link
  const handleLinkTask = async (reqId) => {
    const taskId = taskToLink[reqId];
    if (!taskId) return;
    try {
      await api.linkTaskToRequirement(reqId, taskId);
      setTaskToLink((prev) => ({ ...prev, [reqId]: '' }));
      fetchRequirements();
    } catch (err) {
      alert(err.message || 'Failed to link task');
    }
  };

  // Quick Task Unlink
  const handleUnlinkTask = async (reqId, taskId) => {
    try {
      await api.unlinkTaskFromRequirement(reqId, taskId);
      fetchRequirements();
    } catch (err) {
      alert(err.message || 'Failed to unlink task');
    }
  };

  // Delete Requirement
  const handleDelete = async (id, code) => {
    if (!window.confirm(`Delete requirement ${code}? All traceability links will be removed.`)) {
      return;
    }
    try {
      await api.deleteRequirement(id);
      fetchRequirements();
    } catch (err) {
      alert(err.message || 'Failed to delete requirement');
    }
  };

  // Quick Status change
  const handleStatusChange = async (req, newStatus) => {
    try {
      await api.updateRequirement(req.id, { ...req, status: newStatus });
      fetchRequirements();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Category Icon & Color
  const getCategoryMeta = (cat) => {
    switch (cat) {
      case 'security':
        return { icon: Shield, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'performance':
        return { icon: Zap, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'compliance':
        return { icon: Scale, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'usability':
        return { icon: Smile, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'reliability':
        return { icon: AlertTriangle, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'budget':
        return { icon: DollarSign, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
      default:
        return { icon: Layers, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  // Status Styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'validated':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'implemented':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'approved':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'in_review':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Requirements Engineering Process Header & Pipeline Banner */}
      <div className="bg-[#161a23] dark:bg-[#161a23] border border-[#22273b] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#22273b]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-[#579dff] border border-blue-500/20">
                <Target size={18} />
              </span>
              <h2 className="text-base font-bold text-[#dfe1e6]">
                {t('requirements.title')}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e2433] text-[#579dff] border border-[#262c3f]">
                ITPM & SE Traceability
              </span>
            </div>
            <p className="text-xs text-[#8c9bab] mt-1">
              {t('requirements.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRequirements}
              className="p-2 rounded-lg bg-[#0c1017] hover:bg-[#1e2433] text-[#8c9bab] hover:text-[#dfe1e6] border border-[#262c3f] transition-all cursor-pointer"
              title="Refresh Matrix"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingReq(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>{t('requirements.actions.createBtn')}</span>
            </button>
          </div>
        </div>

        {/* 7-Step Engineering Pipeline Ribbon */}
        <div className="pt-4 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[760px] gap-2 text-[11px] font-medium text-[#8c9bab]">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0c1017] border border-rose-500/30 text-rose-300">
              <AlertTriangle size={12} />
              <span>{t('requirements.pipeline.problem')}</span>
            </div>
            <ArrowRight size={12} className="text-[#626f86] shrink-0" />
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0c1017] border border-amber-500/30 text-amber-300">
              <Users size={12} />
              <span>{t('requirements.pipeline.stakeholders')}</span>
            </div>
            <ArrowRight size={12} className="text-[#626f86] shrink-0" />
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0c1017] border border-purple-500/30 text-purple-300">
              <Shield size={12} />
              <span>{t('requirements.pipeline.earlyNfr')}</span>
            </div>
            <ArrowRight size={12} className="text-[#626f86] shrink-0" />
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0c1017] border border-indigo-500/30 text-indigo-300">
              <Compass size={12} />
              <span>{t('requirements.pipeline.solution')}</span>
            </div>
            <ArrowRight size={12} className="text-[#626f86] shrink-0" />
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0c1017] border border-sky-500/30 text-sky-300">
              <Cpu size={12} />
              <span>{t('requirements.pipeline.frNfr')}</span>
            </div>
            <ArrowRight size={12} className="text-[#626f86] shrink-0" />
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0c1017] border border-blue-500/30 text-blue-300">
              <LinkIcon size={12} />
              <span>{t('requirements.pipeline.traceability')}</span>
            </div>
            <ArrowRight size={12} className="text-[#626f86] shrink-0" />
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0c1017] border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 size={12} />
              <span>{t('requirements.pipeline.validation')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI / Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#161a23] border border-[#22273b] rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-[#8c9bab]">{t('requirements.metrics.totalReqs')}</div>
          <div className="text-xl font-bold text-[#dfe1e6] mt-1">{metrics.totalRequirements}</div>
          <div className="text-[10px] text-[#626f86] mt-1 font-mono">Iteration 1 Loop</div>
        </div>

        <div className="bg-[#161a23] border border-[#22273b] rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-[#8c9bab]">{t('requirements.metrics.functionalCount')}</div>
          <div className="text-xl font-bold text-sky-400 mt-1">{metrics.functionalCount}</div>
          <div className="text-[10px] text-[#626f86] mt-1 font-mono">FRs Specifications</div>
        </div>

        <div className="bg-[#161a23] border border-[#22273b] rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-[#8c9bab]">{t('requirements.metrics.nonFunctionalCount')}</div>
          <div className="text-xl font-bold text-purple-400 mt-1">{metrics.nonFunctionalCount}</div>
          <div className="text-[10px] text-[#626f86] mt-1 font-mono">Early Security & SLA</div>
        </div>

        <div className="bg-[#161a23] border border-[#22273b] rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8c9bab]">{t('requirements.metrics.traceabilityCoverage')}</span>
            <span className="text-xs font-bold text-blue-400">{metrics.coveragePercentage}%</span>
          </div>
          <div className="w-full bg-[#0c1017] h-2 rounded-full mt-2.5 overflow-hidden border border-[#22273b]">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.coveragePercentage}%` }}
            />
          </div>
          <div className="text-[10px] text-[#626f86] mt-1.5 font-mono">
            {metrics.coveredCount} of {metrics.totalRequirements} linked to Tasks
          </div>
        </div>

        <div className="bg-[#161a23] border border-[#22273b] rounded-xl p-3.5 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8c9bab]">{t('requirements.metrics.validationRate')}</span>
            <span className="text-xs font-bold text-emerald-400">{metrics.validationPercentage}%</span>
          </div>
          <div className="w-full bg-[#0c1017] h-2 rounded-full mt-2.5 overflow-hidden border border-[#22273b]">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.validationPercentage}%` }}
            />
          </div>
          <div className="text-[10px] text-[#626f86] mt-1.5 font-mono">
            {metrics.validatedCount} of {metrics.totalRequirements} verified
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="bg-[#161a23] border border-[#22273b] rounded-xl p-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8c9bab]" />
          <input
            type="text"
            placeholder="Search code, title, problem, stakeholders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0c1017] border border-[#2e374f] focus:border-[#579dff] text-[#dfe1e6] text-xs rounded-md pl-8 pr-3 py-1.5 outline-none placeholder-[#626f86] transition-all"
          />
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#579dff]"
        >
          <option value="all">{t('requirements.filters.allTypes')}</option>
          <option value="problem">{t('requirements.filters.problem')}</option>
          <option value="stakeholder_need">{t('requirements.filters.stakeholder_need')}</option>
          <option value="FR">{t('requirements.filters.FR')}</option>
          <option value="NFR">{t('requirements.filters.NFR')}</option>
          <option value="solution_spec">{t('requirements.filters.solution_spec')}</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#579dff]"
        >
          <option value="all">{t('requirements.filters.allCategories')}</option>
          <option value="general">{t('requirements.filters.general')}</option>
          <option value="security">{t('requirements.filters.security')}</option>
          <option value="performance">{t('requirements.filters.performance')}</option>
          <option value="compliance">{t('requirements.filters.compliance')}</option>
          <option value="usability">{t('requirements.filters.usability')}</option>
          <option value="reliability">{t('requirements.filters.reliability')}</option>
          <option value="budget">{t('requirements.filters.budget')}</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-1.5 outline-none cursor-pointer focus:border-[#579dff]"
        >
          <option value="all">{t('requirements.filters.allStatuses')}</option>
          <option value="draft">{t('requirements.status.draft')}</option>
          <option value="in_review">{t('requirements.status.in_review')}</option>
          <option value="approved">{t('requirements.status.approved')}</option>
          <option value="implemented">{t('requirements.status.implemented')}</option>
          <option value="validated">{t('requirements.status.validated')}</option>
        </select>
      </div>

      {/* 4. Requirements & Traceability Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-[#8c9bab] gap-3">
          <Clock size={24} className="animate-spin text-[#579dff]" />
          <span className="text-xs">Loading Requirements Matrix...</span>
        </div>
      ) : requirements.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#22273b] rounded-xl bg-[#121622]/50 p-6">
          <Target size={36} className="mx-auto mb-2 text-[#626f86]" />
          <h3 className="text-sm font-bold text-[#dfe1e6] mb-1">
            {t('requirements.table.emptyTitle')}
          </h3>
          <p className="text-xs text-[#8c9bab] max-w-md mx-auto mb-4">
            {t('requirements.table.emptyDesc')}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingReq(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>{t('requirements.actions.createBtn')}</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#161a23] border border-[#22273b] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#121622] border-b border-[#22273b] text-[11px] font-bold uppercase tracking-wider text-[#8c9bab]">
                  <th className="py-3 px-4 w-12 text-center"></th>
                  <th className="py-3 px-4 w-32">{t('requirements.table.code')}</th>
                  <th className="py-3 px-4 w-44">{t('requirements.table.typeCategory')}</th>
                  <th className="py-3 px-4">{t('requirements.table.title')}</th>
                  <th className="py-3 px-4 w-36">{t('requirements.table.status')}</th>
                  <th className="py-3 px-4 w-72">{t('requirements.table.linkedTasks')}</th>
                  <th className="py-3 px-4 w-24 text-right">{t('requirements.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22273b] text-xs">
                {requirements.map((req) => {
                  const isExpanded = !!expandedRows[req.id];
                  const catMeta = getCategoryMeta(req.category);
                  const CatIcon = catMeta.icon;

                  // Tasks not already linked to this requirement
                  const linkedTaskIds = new Set((req.linked_tasks || []).map((t) => t.id));
                  const availableTasksToLink = projectTasks.filter((t) => !linkedTaskIds.has(t.id));

                  return (
                    <React.Fragment key={req.id}>
                      <tr className="hover:bg-[#1c2230]/60 transition-colors">
                        {/* Expand Toggle */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(req.id)}
                            className="p-1 rounded text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#262c3f] transition-all cursor-pointer"
                            title="Expand Details"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>

                        {/* Code */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-xs text-[#579dff] bg-[#0c1017] px-2 py-0.5 rounded border border-[#2e374f]">
                            {req.code}
                          </span>
                          <div className="text-[10px] text-[#626f86] mt-0.5 font-mono">
                            {req.iteration_cycle || 'Cycle 1'}
                          </div>
                        </td>

                        {/* Type & Category */}
                        <td className="py-3 px-4 space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              req.type === 'FR'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                : req.type === 'NFR'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : req.type === 'problem'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}
                          >
                            {req.type}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-[#8c9bab]">
                            <CatIcon size={11} className="text-[#579dff]" />
                            <span className="capitalize">{req.category}</span>
                          </div>
                        </td>

                        {/* Title & One-line Summary */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#dfe1e6] hover:text-[#579dff] transition-colors cursor-pointer" onClick={() => toggleExpand(req.id)}>
                            {req.title}
                          </div>
                          {req.business_problem && (
                            <div className="text-[11px] text-[#8c9bab] line-clamp-1 mt-0.5">
                              <span className="text-rose-400/80 font-medium">Problem: </span>
                              {req.business_problem}
                            </div>
                          )}
                        </td>

                        {/* Status (with quick change selector) */}
                        <td className="py-3 px-4">
                          <select
                            value={req.status}
                            onChange={(e) => handleStatusChange(req, e.target.value)}
                            className={`text-[11px] font-semibold rounded-md px-2 py-1 border outline-none cursor-pointer ${getStatusBadge(
                              req.status
                            )} bg-[#0c1017]`}
                          >
                            <option value="draft">{t('requirements.status.draft')}</option>
                            <option value="in_review">{t('requirements.status.in_review')}</option>
                            <option value="approved">{t('requirements.status.approved')}</option>
                            <option value="implemented">{t('requirements.status.implemented')}</option>
                            <option value="validated">{t('requirements.status.validated')}</option>
                          </select>
                        </td>

                        {/* Linked Tasks (Traceability Matrix) */}
                        <td className="py-3 px-4">
                          <div className="space-y-1.5">
                            {req.linked_tasks && req.linked_tasks.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {req.linked_tasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0c1017] border border-[#2e374f] text-[11px] group"
                                  >
                                    <span className="font-mono font-semibold text-[#579dff]">
                                      #{task.id}
                                    </span>
                                    <span className="text-[#dfe1e6] max-w-[120px] truncate" title={task.title}>
                                      {task.title}
                                    </span>
                                    <span
                                      className={`text-[9px] px-1 rounded uppercase font-bold ${
                                        task.status === 'closed'
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'bg-blue-500/20 text-blue-300'
                                      }`}
                                    >
                                      {task.status}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUnlinkTask(req.id, task.id)}
                                      className="text-[#626f86] hover:text-rose-400 ml-0.5 transition-colors cursor-pointer"
                                      title="Unlink task"
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : req.type === 'problem' ? (
                              <div className="text-[11px] text-[#8c9bab] italic flex items-center gap-1.5 py-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400/60 inline-block shrink-0"></span>
                                <span>បញ្ហាអាជីវកម្ម (មិនត្រូវការ Task អនុវត្ត)</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#626f86] italic">
                                មិនទាន់មាន Task ភ្ជាប់ (Uncovered)
                              </div>
                            )}

                            {/* Quick Link Task Dropdown */}
                            {availableTasksToLink.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <select
                                  value={taskToLink[req.id] || ''}
                                  onChange={(e) =>
                                    setTaskToLink((prev) => ({ ...prev, [req.id]: e.target.value }))
                                  }
                                  className="bg-[#0c1017] border border-[#2e374f] text-[11px] text-[#8c9bab] rounded px-1.5 py-0.5 max-w-[180px] outline-none"
                                >
                                  <option value="">+ Link project task...</option>
                                  {availableTasksToLink.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      #{t.id} - {t.title}
                                    </option>
                                  ))}
                                </select>
                                {taskToLink[req.id] && (
                                  <button
                                    type="button"
                                    onClick={() => handleLinkTask(req.id)}
                                    className="p-1 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-[10px] font-bold cursor-pointer"
                                    title="Confirm Link"
                                  >
                                    <Check size={11} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReq(req);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 rounded text-[#8c9bab] hover:text-[#579dff] hover:bg-[#262c3f] transition-colors cursor-pointer"
                              title="Edit Requirement"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(req.id, req.code)}
                              className="p-1.5 rounded text-[#8c9bab] hover:text-rose-400 hover:bg-[#262c3f] transition-colors cursor-pointer"
                              title="Delete Requirement"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded 5-Step Engineering Detail View */}
                      {isExpanded && (
                        <tr className="bg-[#121622]/90 border-b border-[#22273b]">
                          <td colSpan={7} className="p-4 pl-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Step 1 & 2: Root Problem & Stakeholders */}
                              <div className="space-y-3 bg-[#161a23] p-3.5 rounded-lg border border-[#22273b]">
                                <div>
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                                    <AlertTriangle size={12} />
                                    Step 1: Root Business Problem (The "Why")
                                  </span>
                                  <p className="text-xs text-[#dfe1e6] mt-1 whitespace-pre-wrap leading-relaxed">
                                    {req.business_problem || 'Not documented.'}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                    <Users size={12} />
                                    Step 2: Stakeholders & Needs
                                  </span>
                                  <p className="text-xs text-[#dfe1e6] mt-1">
                                    {req.stakeholders || 'General System Users'}
                                  </p>
                                </div>
                              </div>

                              {/* Step 4 & 5: Candidate Solution & Specifications */}
                              <div className="space-y-3 bg-[#161a23] p-3.5 rounded-lg border border-[#22273b]">
                                <div>
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                                    <Compass size={12} />
                                    Step 4: Candidate Solution Concept (The "How")
                                  </span>
                                  <p className="text-xs text-[#dfe1e6] mt-1 whitespace-pre-wrap leading-relaxed">
                                    {req.solution_concept || 'Not documented.'}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                    <FileCheck size={12} />
                                    Step 5: Specifications & Acceptance Criteria
                                  </span>
                                  <p className="text-xs text-[#dfe1e6] mt-1 whitespace-pre-wrap leading-relaxed font-mono text-[11px] bg-[#0c1017] p-2 rounded border border-[#2e374f]">
                                    {req.acceptance_criteria || req.details || 'Pending acceptance criteria definition.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Create / Edit Requirement Modal */}
      {isModalOpen && (
        <RequirementModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingReq(null);
          }}
          requirement={editingReq}
          projectId={projectId}
          projectTasks={projectTasks}
          onSaved={() => {
            setIsModalOpen(false);
            setEditingReq(null);
            fetchRequirements();
          }}
        />
      )}
    </div>
  );
}

/**
 * Create / Edit Requirement Modal implementing the 5-Step Engineering Loop
 */
function RequirementModal({ isOpen, onClose, requirement, projectId, projectTasks = [], onSaved }) {
  const { t } = useLanguage();
  const isEdit = !!requirement;

  const [formData, setFormData] = useState({
    code: requirement?.code || '',
    title: requirement?.title || '',
    type: requirement?.type || 'FR',
    category: requirement?.category || 'general',
    priority: requirement?.priority || 'medium',
    status: requirement?.status || 'draft',
    iteration_cycle: requirement?.iteration_cycle || 'Sprint 1',
    business_problem: requirement?.business_problem || '',
    stakeholders: requirement?.stakeholders || '',
    solution_concept: requirement?.solution_concept || '',
    details: requirement?.details || '',
    acceptance_criteria: requirement?.acceptance_criteria || '',
    taskIds: (requirement?.linked_tasks || []).map((t) => t.id),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Requirement title is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        ...formData,
        taskIds: formData.taskIds,
        task_ids: formData.taskIds,
      };

      if (isEdit) {
        await api.updateRequirement(requirement.id, payload);
      } else {
        await api.createRequirement(projectId, payload);
      }
      onSaved();
    } catch (err) {
      console.error('Error saving requirement:', err);
      setError(err.message || 'Failed to save requirement');
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskSelection = (taskId) => {
    setFormData((prev) => {
      const exists = prev.taskIds.includes(taskId);
      return {
        ...prev,
        taskIds: exists ? prev.taskIds.filter((id) => id !== taskId) : [...prev.taskIds, taskId],
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#161a23] border border-[#2e374f] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22273b]">
          <div>
            <h3 className="text-base font-bold text-[#dfe1e6]">
              {isEdit ? t('requirements.modal.editTitle') : t('requirements.modal.createTitle')}
            </h3>
            <p className="text-xs text-[#8c9bab] mt-0.5">
              Follow the 5-point engineering loop: Problem ➔ Stakeholders ➔ Early NFRs ➔ Candidate Solution ➔ FRs/NFRs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#22273b] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Row 1: Code & Title */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#8c9bab] mb-1">
                {t('requirements.modal.codeLabel')}
              </label>
              <input
                type="text"
                placeholder="e.g. FR-01"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs font-mono rounded-md px-3 py-2 outline-none focus:border-[#579dff]"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-[#8c9bab] mb-1">
                {t('requirements.modal.titleLabel')} *
              </label>
              <input
                type="text"
                required
                placeholder="Clear, assertive requirement summary..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-3 py-2 outline-none focus:border-[#579dff]"
              />
            </div>
          </div>

          {/* Row 2: Type, Category, Priority, Status, Iteration */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#8c9bab] mb-1">
                {t('requirements.modal.typeLabel')}
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-2 outline-none focus:border-[#579dff]"
              >
                <option value="FR">FR (Functional)</option>
                <option value="NFR">NFR (Non-Functional)</option>
                <option value="problem">Root Problem</option>
                <option value="stakeholder_need">Stakeholder Need</option>
                <option value="solution_spec">Solution Spec</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#8c9bab] mb-1">
                {t('requirements.modal.categoryLabel')}
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-2 outline-none focus:border-[#579dff]"
              >
                <option value="general">General</option>
                <option value="security">Security & Auth</option>
                <option value="performance">Performance & SLA</option>
                <option value="compliance">Compliance & Legal</option>
                <option value="usability">Usability & UX</option>
                <option value="reliability">Reliability</option>
                <option value="budget">Budget / Resource</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#8c9bab] mb-1">
                {t('requirements.modal.priorityLabel')}
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-2 outline-none focus:border-[#579dff]"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#8c9bab] mb-1">
                {t('requirements.modal.statusLabel')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-2 outline-none focus:border-[#579dff]"
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="implemented">Implemented</option>
                <option value="validated">Validated</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#8c9bab] mb-1">
                {t('requirements.modal.iterationLabel')}
              </label>
              <input
                type="text"
                placeholder="e.g. Sprint 1"
                value={formData.iteration_cycle}
                onChange={(e) => setFormData({ ...formData, iteration_cycle: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-2.5 py-2 outline-none focus:border-[#579dff]"
              />
            </div>
          </div>

          {/* 5-Step Refinement Loop Form Fields */}
          <div className="space-y-4 pt-2 border-t border-[#22273b]">
            {/* Step 1: Root Problem */}
            <div>
              <label className="block text-[11px] font-bold text-rose-400 mb-1">
                {t('requirements.modal.problemLabel')}
              </label>
              <p className="text-[10px] text-[#8c9bab] mb-1.5">
                {t('requirements.modal.problemHelp')}
              </p>
              <textarea
                rows={2}
                placeholder="What core pain point or business objective drives this? (Why does this matter?)"
                value={formData.business_problem}
                onChange={(e) => setFormData({ ...formData, business_problem: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none focus:border-[#579dff]"
              />
            </div>

            {/* Step 2: Stakeholders */}
            <div>
              <label className="block text-[11px] font-bold text-amber-400 mb-1">
                {t('requirements.modal.stakeholdersLabel')}
              </label>
              <p className="text-[10px] text-[#8c9bab] mb-1.5">
                {t('requirements.modal.stakeholdersHelp')}
              </p>
              <input
                type="text"
                placeholder="e.g. Lead Architects, QA Engineers, Enterprise Tenants"
                value={formData.stakeholders}
                onChange={(e) => setFormData({ ...formData, stakeholders: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md px-3 py-2 outline-none focus:border-[#579dff]"
              />
            </div>

            {/* Step 4: Candidate Solution Concept */}
            <div>
              <label className="block text-[11px] font-bold text-indigo-400 mb-1">
                {t('requirements.modal.solutionLabel')}
              </label>
              <p className="text-[10px] text-[#8c9bab] mb-1.5">
                {t('requirements.modal.solutionHelp')}
              </p>
              <textarea
                rows={2}
                placeholder="Architectural approach, module design, or protocol mechanism..."
                value={formData.solution_concept}
                onChange={(e) => setFormData({ ...formData, solution_concept: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs rounded-md p-2.5 outline-none focus:border-[#579dff]"
              />
            </div>

            {/* Step 5: Testable Acceptance Criteria */}
            <div>
              <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                {t('requirements.modal.detailsLabel')}
              </label>
              <p className="text-[10px] text-[#8c9bab] mb-1.5">
                {t('requirements.modal.detailsHelp')}
              </p>
              <textarea
                rows={3}
                placeholder="Given [context], When [action], Then [measurable result]..."
                value={formData.acceptance_criteria}
                onChange={(e) => setFormData({ ...formData, acceptance_criteria: e.target.value })}
                className="w-full bg-[#0c1017] border border-[#2e374f] text-[#dfe1e6] text-xs font-mono rounded-md p-2.5 outline-none focus:border-[#579dff]"
              />
            </div>

            {/* Traceability: Task Linking */}
            {projectTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-400">
                      {t('requirements.modal.linkTasksLabel')}
                      {formData.taskIds.length > 0 && (
                        <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-[#579dff]">
                          {formData.taskIds.length} ភ្ជាប់
                        </span>
                      )}
                    </label>
                    <p className="text-[10px] text-[#8c9bab] mt-0.5">
                      {t('requirements.modal.linkTasksHelp')}
                    </p>
                  </div>

                  {/* Quick Select / Deselect All Action Buttons */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {formData.taskIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, taskIds: [] }))}
                        className="px-2 py-0.5 rounded text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 font-medium transition-colors cursor-pointer"
                        title="Unlink all tasks from this requirement"
                      >
                        ដកចេញទាំងអស់ (Clear All)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          taskIds: projectTasks.map((t) => t.id),
                        }))
                      }
                      className="px-2 py-0.5 rounded text-[#8c9bab] hover:text-[#dfe1e6] bg-[#0c1017] hover:bg-[#1e2433] border border-[#2e374f] font-medium transition-colors cursor-pointer"
                      title="Select all project tasks"
                    >
                      ជ្រើសរើសទាំងអស់
                    </button>
                  </div>
                </div>

                {/* Problem type note */}
                {formData.type === 'problem' && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                      <span>
                        <strong>ចំណាំ៖</strong> ប្រភេទ «បញ្ហាអាជីវកម្ម (Root Problem)» មិនចាំបាច់ភ្ជាប់ជាមួយ Task ទេ ដើម្បីឱ្យក្រុមការងារដឹងពីឫសគល់បញ្ហា។
                      </span>
                    </div>
                    {formData.taskIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, taskIds: [] }))}
                        className="shrink-0 px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        ដក Task ចេញ
                      </button>
                    )}
                  </div>
                )}

                <div className="max-h-36 overflow-y-auto border border-[#2e374f] bg-[#0c1017] rounded-md p-2 space-y-1">
                  {projectTasks.map((t) => {
                    const isSelected = formData.taskIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTaskSelection(t.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#1e2433] text-[#579dff] font-semibold'
                            : 'text-[#8c9bab] hover:bg-[#161a23] hover:text-[#dfe1e6]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px]">#{t.id}</span>
                          <span className="truncate">{t.title}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-[#579dff]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#22273b] bg-[#121622]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8c9bab] hover:text-[#dfe1e6] hover:bg-[#1e2433] transition-colors cursor-pointer"
          >
            {t('requirements.actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? <Clock size={14} className="animate-spin" /> : <Check size={14} />}
            <span>{t('requirements.actions.saveChanges')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}


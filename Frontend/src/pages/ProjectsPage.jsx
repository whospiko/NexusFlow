import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { CreateProjectModal } from '../components/CreateProjectModal.jsx';
import { EditProjectModal } from '../components/EditProjectModal.jsx';
import { DuplicateProjectModal } from '../components/DuplicateProjectModal.jsx';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Plus,
  Folder,
  ArrowRight,
  Trash2,
  Clock,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  Shield,
  Edit3,
  Copy,
} from 'lucide-react';

export function ProjectsPage() {
  const { user } = useAuth();
  const { t, formatRelativeTime } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [duplicateTargetProject, setDuplicateTargetProject] = useState(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.getProjects();
      setProjects(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const handleProjectCreated = async (newProj) => {
    await api.createProject(newProj);
    await fetchProjects();
  };

  const handleDeleteProject = async (id, name, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t('projects.confirmDelete', { name }))) {
      return;
    }

    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(t('projects.deleteFailed', { message: err.message }));
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Jira Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#22273b]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#dfe1e6]">
              {t('projects.pageTitle')}
            </h1>
            {user && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-medium">
                {t('auth.active')}: {user.name}
              </span>
            )}
          </div>
          <p className="text-xs text-[#8c9bab]">
            {t('projects.pageDesc')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={15} strokeWidth={2.8} />
          <span>{t('projects.createBtn')}</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="my-6 flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8c9bab]" />
          <input
            type="text"
            placeholder={t('projects.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121622] border border-[#262c3f] focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff] text-[#dfe1e6] text-xs rounded-md pl-9 pr-3 py-2 outline-none placeholder-[#626f86] transition-all"
          />
        </div>

        <div className="text-xs text-[#8c9bab]">
          {filteredProjects.length} {t('nav.projects')}
        </div>
      </div>

      {/* Database Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          <p className="font-semibold mb-1">{t('common.error')}:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-[#8c9bab] gap-3">
          <Clock size={24} className="animate-spin text-[#579dff]" />
          <span className="text-xs">{t('common.loading')}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProjects.length === 0 && (
        <div className="py-16 text-center border border-dashed border-[#22273b] rounded-lg bg-[#121622]/50 p-6">
          <Folder size={40} className="mx-auto mb-3 text-[#626f86]" />
          <h3 className="text-sm font-bold text-[#dfe1e6] mb-1">{t('projects.emptyTitle')}</h3>
          <p className="text-xs text-[#8c9bab] max-w-md mx-auto mb-4">
            {t('projects.emptyDesc')}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>{t('projects.createBtn')}</span>
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => {
            const isOwner = proj.is_owner;
            return (
              <Link
                key={proj.id}
                to={`/projects/${proj.id}`}
                className="bg-[#161a23] hover:bg-[#1c212e] border border-[#22273b] hover:border-[#3b4460] rounded-lg p-5 flex flex-col justify-between transition-all group shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0052cc] to-[#0c66e4] text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                        {proj.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-[#dfe1e6] group-hover:text-[#579dff] transition-colors leading-snug">
                            {proj.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {isOwner ? (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {t('projects.ownerRole')}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {t('projects.memberRole')}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-[#8c9bab]">
                            {t('projects.projectKey')}: ALPHA-{proj.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDuplicateTargetProject(proj);
                          setIsDuplicateModalOpen(true);
                        }}
                        className="p-1.5 text-[#8c9bab] hover:text-indigo-400 hover:bg-indigo-500/15 rounded transition-colors cursor-pointer"
                        title={t('projectDetail.duplicate')}
                      >
                        <Copy size={13} />
                      </button>
                      {isOwner && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setProjectToEdit(proj);
                              setIsEditProjectModalOpen(true);
                            }}
                            className="p-1.5 text-[#8c9bab] hover:text-[#579dff] hover:bg-[#0c66e4]/15 rounded transition-colors cursor-pointer"
                            title={t('projects.editProject')}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProject(proj.id, proj.name, e)}
                            className="p-1.5 text-[#8c9bab] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title={t('projects.deleteProject')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#8c9bab] line-clamp-2 leading-relaxed mb-3 min-h-[32px]">
                    {proj.description || t('issueDetail.noDescription')}
                  </p>

                  <div className="text-[11px] text-[#8c9bab] flex items-center justify-between pb-3">
                    <span>{t('projects.lead')}: <strong className="text-white">{proj.owner_name}</strong></span>
                    <span className="flex items-center gap-1 text-[#dfe1e6]">
                      <Users size={12} className="text-blue-400" />
                      {proj.team_count || 1} {t('projects.members')}
                    </span>
                  </div>
                </div>

                {/* Bottom Aggregate Info Strip */}
                <div className="pt-3 border-t border-[#22273b] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8c9bab]">
                    <span>{t('projects.totalIssues')}:</span>
                    <strong className="text-[#dfe1e6] font-semibold">{proj.total_issues}</strong>
                  </div>

                  {/* Status Pills Summary */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-[#1e2333] text-[#8c9bab] border border-[#2e374f]">
                      {proj.open_issues} {t('status.open')}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#0c66e4]/15 text-[#579dff] border border-[#0c66e4]/30">
                      {proj.in_progress_issues} {t('status.in-progress')}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#22a06b]/15 text-[#4bce97] border border-[#22a06b]/30">
                      {proj.resolved_issues} {t('status.closed')}
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs font-semibold text-[#579dff] group-hover:translate-x-0.5 transition-transform">
                    <span>{t('projects.viewBoard')}</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      <EditProjectModal
        isOpen={isEditProjectModalOpen}
        onClose={() => {
          setIsEditProjectModalOpen(false);
          setProjectToEdit(null);
        }}
        project={projectToEdit}
        onProjectUpdated={fetchProjects}
      />

      <DuplicateProjectModal
        isOpen={isDuplicateModalOpen}
        onClose={() => {
          setIsDuplicateModalOpen(false);
          setDuplicateTargetProject(null);
        }}
        project={duplicateTargetProject}
        onDuplicated={() => fetchProjects()}
      />
    </div>
  );
}

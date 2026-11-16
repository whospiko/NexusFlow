import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { InviteMemberModal } from '../components/InviteMemberModal.jsx';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Layers,
  ArrowRight,
  Clock,
  Trash2,
  CheckCircle2,
  RotateCw,
  Copy,
} from 'lucide-react';

export function TeamsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [projectTeams, setProjectTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite Modal state
  const [selectedProjectForInvite, setSelectedProjectForInvite] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await api.getTeams();
      setProjectTeams(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load project teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [user]);

  const handleOpenInvite = (proj) => {
    setSelectedProjectForInvite(proj);
    setIsInviteModalOpen(true);
  };

  const handleRemoveMember = async (projectId, memberUserId, memberName) => {
    if (!window.confirm(t('teams.confirmRemoveMember', { name: memberName }))) {
      return;
    }
    try {
      await api.removeProjectTeamMember(projectId, memberUserId);
      await fetchTeams();
    } catch (err) {
      alert(`Failed to remove member: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#22273b]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#dfe1e6]">
              {t('teams.pageTitle')}
            </h1>
            {user && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-medium">
                {t('teams.signedInAs', { name: user.name })}
              </span>
            )}
          </div>
          <p className="text-xs text-[#8c9bab] max-w-2xl leading-relaxed">
            {t('teams.pageDesc')}
          </p>
        </div>

        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Layers size={14} />
          <span>{t('teams.goToProjects')}</span>
        </Link>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="my-6 p-4 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          <p className="font-semibold mb-1">{t('common.error')}:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-[#8c9bab] gap-3">
          <Clock size={24} className="animate-spin text-[#579dff]" />
          <span className="text-xs">{t('common.loading')}</span>
        </div>
      )}

      {/* CASE 1: NEW USER WITH 0 TEAMS */}
      {!loading && projectTeams.length === 0 && (
        <div className="my-10 py-16 text-center border border-dashed border-[#22273b] rounded-xl bg-[#121622]/60 p-8 max-w-2xl mx-auto shadow-lg">
          <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-4">
            <Users size={28} />
          </div>
          <h2 className="text-base font-bold text-white mb-2">
            {t('teams.emptyTeams')}
          </h2>
          <p className="text-xs text-[#8c9bab] leading-relaxed mb-6">
            {t('teams.pageDesc')}
            <br />
            {t('teams.createProjectFirst')}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/projects"
              className="px-4 py-2 bg-[#0c66e4] hover:bg-[#0052cc] text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
            >
              + {t('projects.createBtn')}
            </Link>
          </div>
        </div>
      )}

      {/* CASE 2: USER BELONGS TO 1 OR MORE PROJECT TEAMS */}
      {!loading && projectTeams.length > 0 && (
        <div className="my-6 space-y-8">
          <div className="text-xs text-[#8c9bab]">
            {t('teams.membersCount', { count: projectTeams.length })}
          </div>

          {projectTeams.map((team) => {
            const isOwnerOrAdmin = team.is_owner || team.my_role === 'admin';
            const pendingList = team.pending_invitations || [];
            const membersList = team.members || [];

            return (
              <div
                key={team.project_id}
                className="bg-[#161a23] border border-[#22273b] rounded-xl overflow-hidden shadow-sm"
              >
                {/* Team Card Header */}
                <div className="px-6 py-4 bg-[#1b212e] border-b border-[#22273b] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0052cc] to-[#0c66e4] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                      {team.project_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white">
                          {team.project_name}
                        </h2>
                        {team.is_owner ? (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {t('teams.roleAdmin')}
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {t('teams.roleMember')}: {team.my_role}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8c9bab]">
                        {t('projects.lead')}: <strong className="text-white">{team.owner_name}</strong> &bull; {membersList.length} {t('projects.members')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenInvite({
                            id: team.project_id,
                            name: team.project_name,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c66e4]/20 hover:bg-[#0c66e4]/30 text-[#579dff] text-xs font-semibold border border-[#0c66e4]/40 transition-colors cursor-pointer"
                      >
                        <UserPlus size={13} />
                        <span>{t('teams.inviteBtn')}</span>
                      </button>
                    )}

                    <Link
                      to={`/projects/${team.project_id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#121622] hover:bg-[#1f2638] text-[#dfe1e6] text-xs font-semibold border border-[#2e374f] transition-colors"
                    >
                      <span>{t('projects.viewBoard')}</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Active Verified Members Grid */}
                  <div>
                    <h3 className="text-xs font-bold uppercase text-[#8c9bab] tracking-wider mb-3 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>{t('projects.members')} ({membersList.length})</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {membersList.map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg bg-[#0c1017] border border-[#22273b] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <img
                              src={m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`}
                              alt={m.name}
                              className="w-7 h-7 rounded-full bg-[#1b212e] border border-[#2e374f] shrink-0"
                            />
                            <div className="overflow-hidden">
                              <div className="font-semibold text-white truncate flex items-center gap-1.5">
                                <span>{m.name}</span>
                                {m.is_owner && (
                                  <span className="text-[9px] uppercase font-bold text-blue-400">
                                    ({t('projects.ownerRole')})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#8c9bab] font-mono truncate">
                                {m.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-[#1e2333] text-[#8c9bab] border border-[#2e374f]">
                              {m.role}
                            </span>
                            {team.is_owner && !m.is_owner && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(team.project_id, m.id, m.name)}
                                className="p-1 text-[#8c9bab] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                                title={t('teams.removeMember')}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pending Gmail Verifications for this Project */}
                  {pendingList.length > 0 && (
                    <div className="pt-4 border-t border-[#22273b]">
                      <h3 className="text-xs font-bold uppercase text-[#8c9bab] tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Clock size={13} className="text-amber-400" />
                        <span>{t('teams.pendingInvites')} ({pendingList.length})</span>
                      </h3>

                      <div className="space-y-2">
                        {pendingList.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-3 rounded-lg bg-[#0c1017] border border-[#22273b] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Mail size={14} className="text-blue-400" />
                              <span className="font-mono text-white font-semibold">{inv.invitee_email}</span>
                              <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.2 rounded">
                                {t('acceptInvite.accepting')}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-blue-300 bg-blue-900/40 px-1.5 py-0.2 rounded">
                                {inv.role}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#8c9bab]">
                              {t('acceptInvite.subtitle')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Member Modal */}
      {selectedProjectForInvite && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          projectId={selectedProjectForInvite.id}
          projectName={selectedProjectForInvite.name}
          onMemberInvited={fetchTeams}
        />
      )}
    </div>
  );
}

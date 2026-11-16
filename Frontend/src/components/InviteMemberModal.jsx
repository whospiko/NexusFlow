import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { Mail, Clock, CheckCircle2, RotateCw, Trash2, Copy, Shield, Users, AlertCircle } from 'lucide-react';

export function InviteMemberModal({ isOpen, onClose, projectId, projectName, onMemberInvited }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [activeMembers, setActiveMembers] = useState([]);
  const [copiedToken, setCopiedToken] = useState(null);
  const [activeTab, setActiveTab] = useState('invite'); // 'invite' or 'team'

  const refreshData = async () => {
    if (!projectId) return;
    try {
      const res = await api.getProjectMembers(projectId);
      if (res.success) {
        setActiveMembers(res.data || []);
        setPendingInvites(res.pending || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      refreshData();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setResult(null);

    try {
      const res = await api.inviteMember(projectId, {
        invitee_email: email.trim(),
        role,
      });

      if (res.success) {
        setResult(res);
        setEmail('');
        await refreshData();
        if (onMemberInvited) onMemberInvited();
      } else {
        setErrorMsg(res.message || 'Failed to send invitation');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (invitationId) => {
    try {
      setActionLoadingId(invitationId);
      setErrorMsg('');
      const res = await api.resendInvitation(projectId, invitationId);
      if (res.success) {
        setResult({
          message: res.message,
          emailResult: res.emailResult,
          inviteLink: res.inviteLink,
        });
        await refreshData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend email');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelInvite = async (invitationId) => {
    if (!window.confirm('Cancel this pending invitation? The recipient will not be able to join using this link.')) {
      return;
    }
    try {
      setActionLoadingId(invitationId);
      await api.cancelInvitation(projectId, invitationId);
      await refreshData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel invitation');
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (token) => {
    const link = `${window.location.origin}/invite/accept?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-[#111c2e] border border-[#223554] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#223554] flex items-center justify-between bg-[#16233b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Mail className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{t('modals.inviteTitle')}</h2>
              <p className="text-xs text-[#8c9bab]">
                {t('filters.projectFilter')}: <span className="text-blue-300 font-semibold">{projectName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8c9bab] hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#223554] bg-[#0c1424] px-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('invite')}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'invite'
                ? 'border-[#0052cc] text-blue-400 font-bold'
                : 'border-transparent text-[#8c9bab] hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{t('teams.inviteBtn')}</span>
            {pendingInvites.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                {pendingInvites.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'team'
                ? 'border-[#0052cc] text-blue-400 font-bold'
                : 'border-transparent text-[#8c9bab] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t('projects.members')} ({activeMembers.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-lg flex items-start gap-2">
              <span className="text-red-400">⚠️</span>
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Success Banner */}
          {result && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-lg text-emerald-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{result.message}</span>
              </div>

              {result.emailResult?.delivered ? (
                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                  Real Gmail invitation email was sent to your teammate.
                </p>
              ) : (
                <div className="space-y-2 pt-1 border-t border-emerald-800/60">
                  <p className="text-[11px] text-[#c7d1db]">
                    {t('teams.copyInviteLink')}:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={result.inviteLink}
                      className="flex-1 bg-[#0a1424] border border-[#2d4369] text-blue-300 font-mono text-[11px] px-2.5 py-1.5 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(result.inviteLink);
                        alert(t('teams.copied'));
                      }}
                      className="px-2.5 py-1.5 bg-[#0052cc] hover:bg-[#0747a6] text-white rounded text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      {t('teams.copyInviteLink')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invite' ? (
            <>
              {/* Educational Verification Notice */}
              <div className="p-3 bg-blue-950/30 border border-blue-900/60 rounded-lg text-xs text-blue-300 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong>{t('auth.tenancyNoteTitle')}</strong> {t('teams.pageDesc')}
                </div>
              </div>

              {/* Invitation Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    {t('modals.inviteEmail')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('modals.inviteEmailPlaceholder')}
                    className="w-full bg-[#0a1424] border border-[#2d4369] rounded-lg px-3 py-2 text-sm text-white placeholder-[#57687d] focus:outline-none focus:border-[#388bfd]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    {t('modals.inviteRole')}
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#0a1424] border border-[#2d4369] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#388bfd]"
                  >
                    <option value="member">{t('teams.roleMember')}</option>
                    <option value="admin">{t('teams.roleAdmin')}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-2.5 px-4 bg-[#0052cc] hover:bg-[#0747a6] disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('modals.sendingInvite')}</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>{t('modals.sendInviteBtn')}</span>
                    </>
                  )}
                </button>
              </form>

              {/* Pending Gmail Verifications Table */}
              <div className="pt-4 border-t border-[#22273b]">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold uppercase text-[#8c9bab] tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('teams.pendingInvites')} ({pendingInvites.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={refreshData}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>{t('common.refresh')}</span>
                  </button>
                </div>

                {pendingInvites.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#0a1424] border border-[#22273b] text-center text-xs text-[#626f86]">
                    {t('common.none')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-lg bg-[#0a1424] border border-[#22273b] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white font-mono">{inv.invitee_email}</span>
                            <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.2 rounded">
                              {t('acceptInvite.accepting')}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-blue-300 bg-blue-900/40 px-1.5 py-0.2 rounded">
                              {inv.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8c9bab] mt-0.5">
                            {inv.inviter_name}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inv.token)}
                            className="px-2 py-1 rounded bg-[#16233b] hover:bg-[#1f2f4e] text-blue-300 border border-[#2d4369] text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Copy direct verification link"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedToken === inv.token ? t('teams.copied') : t('teams.copyInviteLink')}</span>
                          </button>

                          <button
                            type="button"
                            disabled={actionLoadingId === inv.id}
                            onClick={() => handleResend(inv.id)}
                            className="px-2 py-1 rounded bg-[#0c66e4]/20 hover:bg-[#0c66e4]/30 text-[#579dff] border border-[#0c66e4]/30 text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCw className={`w-3 h-3 ${actionLoadingId === inv.id ? 'animate-spin' : ''}`} />
                            <span>{t('common.refresh')}</span>
                          </button>

                          <button
                            type="button"
                            disabled={actionLoadingId === inv.id}
                            onClick={() => handleCancelInvite(inv.id)}
                            className="p-1 text-[#8c9bab] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Active Team Roster Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold uppercase text-[#8c9bab] tracking-wider">
                  {t('projects.members')} ({activeMembers.length})
                </h3>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('acceptInvite.verifiedSuccess')}</span>
                </span>
              </div>

              <div className="space-y-2">
                {activeMembers.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg bg-[#0a1424] border border-[#22273b] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`}
                        alt={m.name}
                        className="w-8 h-8 rounded-full bg-[#16233b] border border-[#2d4369]"
                      />
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{m.name}</span>
                          {m.is_owner && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {t('teams.roleAdmin')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8c9bab] font-mono">{m.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                        {m.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#22273b] bg-[#16233b] flex justify-between items-center text-xs text-[#8c9bab]">
          <span>{t('projectDetail.sidebarFooter')}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0a1424] hover:bg-[#1f2937] text-[#c7d1db] text-xs font-medium rounded-lg border border-[#2d4369] transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InviteMemberModal;

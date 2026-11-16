import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ShieldCheck, AlertTriangle, CheckCircle2, Mail, ArrowRight, UserCheck, LogIn } from 'lucide-react';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, devLogin, logout } = useAuth();
  const { t } = useLanguage();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      setErrorMsg(t('acceptInvite.invalidToken'));
      setLoading(false);
      return;
    }

    api.getInvitationByToken(token)
      .then((res) => {
        if (res.success) {
          setInvitation(res.data);
        } else {
          setErrorMsg(res.message || t('acceptInvite.invalidToken'));
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || t('acceptInvite.invalidToken'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const targetEmail = invitation?.invitee_email?.toLowerCase().trim();
  const currentEmail = user?.email?.toLowerCase().trim();
  const isEmailMatching = user && targetEmail && currentEmail === targetEmail;

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setErrorMsg('');
    try {
      const res = await api.acceptInvitation(token);
      if (res.success) {
        setSuccessMsg(res.message || t('acceptInvite.verifiedSuccess'));
        setTimeout(() => {
          navigate(`/projects/${res.projectId || invitation?.project_id}`);
        }, 1500);
      } else {
        setErrorMsg(res.message || 'Failed to verify invitation.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to verify invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSwitchToInvitee = async () => {
    if (!targetEmail) return;
    try {
      setLoading(true);
      await devLogin(targetEmail, targetEmail.split('@')[0]);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to switch account');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070d19] text-[#c7d1db] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-[#111c2e] border border-[#223554] px-6 py-4 rounded-xl shadow-lg">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">{t('acceptInvite.accepting')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-[#c7d1db] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar with Language Switcher */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher variant="simple" />
      </div>

      <div className="w-full max-w-lg bg-[#111c2e] border border-[#223554] rounded-xl shadow-2xl p-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0052cc] text-white shadow-lg shadow-blue-500/20 mb-3">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('acceptInvite.title')}</h1>
          <p className="text-xs text-[#8c9bab] mt-1 font-medium">{t('acceptInvite.subtitle')}</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{t('auth.authNotice')}</div>
              <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold">{successMsg}</div>
              <p className="text-[11px] text-emerald-300">Redirecting...</p>
            </div>
          </div>
        )}

        {invitation && (
          <div className="space-y-5">
            {/* Project Details Box */}
            <div className="p-4 rounded-lg bg-[#16233b] border border-[#223554]">
              <div className="text-[10px] uppercase font-bold text-[#8c9bab] tracking-wider mb-1">
                {t('acceptInvite.invitationDetails')}
              </div>
              <h2 className="text-xl font-bold text-white mb-1">{invitation.project_name}</h2>
              {invitation.project_description && (
                <p className="text-xs text-[#8c9bab] mb-3 leading-relaxed">
                  {invitation.project_description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#223554]/80 text-xs">
                <div>
                  <span className="text-[#8c9bab]">{t('acceptInvite.invitedBy')} </span>
                  <span className="font-semibold text-white">{invitation.inviter_name}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-[#8c9bab]" />
                <div>
                  <span className="text-[#8c9bab]">{t('acceptInvite.targetEmail')} </span>
                  <span className="font-mono text-blue-300 font-semibold">{invitation.invitee_email}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-[#8c9bab]" />
                <div>
                  <span className="text-[#8c9bab]">{t('acceptInvite.assignedRole')} </span>
                  <span className="font-semibold uppercase text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800 text-[10px]">
                    {invitation.role}
                  </span>
                </div>
              </div>
            </div>

            {/* IDENTITY VERIFICATION STATUS PANEL */}
            {!user ? (
              /* Case 1: User is not logged in */
              <div className="p-4 bg-[#0a1424] border border-[#2d4369] rounded-lg space-y-3 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <LogIn className="w-4 h-4" />
                  <span>{t('auth.logIn')}</span>
                </div>
                <p className="text-[11px] text-[#8c9bab] leading-relaxed">
                  {t('acceptInvite.subtitle')}
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSwitchToInvitee}
                    className="w-full py-2 px-3 rounded-lg bg-[#0052cc] hover:bg-[#0747a6] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {t('auth.signInAs', { name: invitation.invitee_email.split('@')[0], email: invitation.invitee_email })}
                  </button>
                </div>
              </div>
            ) : !isEmailMatching ? (
              /* Case 2: User is logged in as DIFFERENT account */
              <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-lg space-y-3 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>{t('auth.authNotice')}</span>
                </div>
                <p className="text-[11px] text-[#c7d1db] leading-relaxed">
                  {t('acceptInvite.emailMismatchWarning', { current: user.email, target: invitation.invitee_email })}
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSwitchToInvitee}
                    className="flex-1 py-2 px-3 bg-[#0052cc] hover:bg-[#0747a6] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    {t('acceptInvite.switchAccountToAccept', { target: invitation.invitee_email })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate(`/login?redirect=/invite/accept?token=${token}`);
                    }}
                    className="py-2 px-3 bg-[#16233b] hover:bg-[#1d2e4d] border border-[#2d4369] text-white text-xs rounded-lg transition-all cursor-pointer"
                  >
                    {t('nav.logOut')}
                  </button>
                </div>
              </div>
            ) : (
              /* Case 3: Logged in and MATCHING the invited Gmail address */
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/80 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-300">{t('acceptInvite.verifiedSuccess')}</div>
                    <div className="text-[11px] text-[#8c9bab] font-mono">{user.email}</div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {t('common.active')}
                </span>
              </div>
            )}

            {/* Accept Button */}
            {user && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting || invitation.isExpired || !isEmailMatching || !!successMsg}
                className="w-full py-3 px-4 rounded-lg bg-[#0052cc] hover:bg-[#0747a6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {accepting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('acceptInvite.accepting')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('acceptInvite.acceptBtn')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link to="/projects" className="text-xs text-[#8c9bab] hover:text-white transition-colors">
            &larr; {t('acceptInvite.backToProjects')}
          </Link>
        </div>
      </div>
    </div>
  );
}

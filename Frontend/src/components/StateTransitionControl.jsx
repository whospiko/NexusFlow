import React, { useState } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { StatusBadge } from './StatusBadge.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export function StateTransitionControl({ currentStatus, allowedTransitions = [], onTransition, loading }) {
  const { t } = useLanguage();
  const [errorMsg, setErrorMsg] = useState(null);
  const [testTransitionLoading, setTestTransitionLoading] = useState(false);

  const handleAllowedClick = async (target) => {
    setErrorMsg(null);
    try {
      await onTransition(target);
    } catch (err) {
      setErrorMsg(err.data?.message || err.message);
    }
  };

  const handleTriggerIllegalTransition = async () => {
    setErrorMsg(null);
    setTestTransitionLoading(true);
    try {
      let illegalTarget = 'open';
      if (currentStatus === 'open') illegalTarget = 'resolved';
      if (currentStatus === 'resolved') illegalTarget = 'open';
      if (currentStatus === 'closed') illegalTarget = 'open';

      await onTransition(illegalTarget);
    } catch (err) {
      setErrorMsg(err.data?.message || err.message);
    } finally {
      setTestTransitionLoading(false);
    }
  };

  return (
    <div className="bg-[#161a23] border border-[#22273b] rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22273b]">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#9fadbc]">
            {t('issueDetail.workflowTransitions')}
          </h4>
          <p className="text-xs text-[#8c9bab] mt-0.5">
            {t('issueDetail.workflowDesc')}
          </p>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      {/* Allowed Transitions Action Buttons */}
      <div className="mb-3">
        <span className="block text-[11px] font-semibold text-[#8c9bab] uppercase tracking-wider mb-2">
          {t('issueDetail.permittedTransitions')}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {allowedTransitions.length === 0 ? (
            <span className="text-xs text-[#8c9bab] italic">
              {t('issueDetail.noFurtherTransitions')}
            </span>
          ) : (
            allowedTransitions.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => handleAllowedClick(target)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e2333] hover:bg-[#282e42] border border-[#2e374f] hover:border-[#579dff]/50 text-xs font-medium text-[#dfe1e6] transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{t('issueDetail.moveTo')}</span>
                <ArrowRight size={12} className="text-[#8c9bab]" />
                <StatusBadge status={target} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Interview Demo Tool: Trigger Forbidden Jump */}
      <div className="pt-3 border-t border-[#22273b] flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] text-[#8c9bab]">
          {t('issueDetail.interviewProofGuard')}
        </span>
        <button
          type="button"
          onClick={handleTriggerIllegalTransition}
          disabled={loading || testTransitionLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 border-dashed transition-all cursor-pointer disabled:opacity-50"
          title="Attempt an invalid transition (e.g. resolved -> open) to demonstrate backend rejection"
        >
          <ShieldAlert size={12} />
          <span>{t('issueDetail.testIllegalJump')}</span>
        </button>
      </div>

      {/* Rejection / Validation feedback alert */}
      {errorMsg && (
        <div className="mt-3 p-3 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs leading-relaxed animate-fade-in">
          <div className="flex items-center gap-1.5 font-bold mb-1 text-rose-400">
            <ShieldAlert size={14} />
            <span>{t('issueDetail.backendGuardTriggered')}</span>
          </div>
          <p>{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

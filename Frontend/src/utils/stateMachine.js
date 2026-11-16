/**
 * Client-side State Transition helper matching Backend rules
 */
export const ALLOWED_TRANSITIONS = {
  'open': ['in-progress', 'closed'],
  'in-progress': ['resolved', 'open', 'closed'],
  'resolved': ['closed', 'in-progress'],
  'closed': ['in-progress'],
};

export const KANBAN_COLUMNS = [
  { id: 'open', title: 'To Do / Open', color: '#3b82f6', bgLight: 'rgba(59, 130, 246, 0.1)' },
  { id: 'in-progress', title: 'In Progress', color: '#a855f7', bgLight: 'rgba(168, 85, 247, 0.1)' },
  { id: 'resolved', title: 'Resolved / QA', color: '#10b981', bgLight: 'rgba(16, 185, 129, 0.1)' },
  { id: 'closed', title: 'Closed / Done', color: '#64748b', bgLight: 'rgba(100, 116, 139, 0.1)' },
];

export function isValidTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(targetStatus));
}


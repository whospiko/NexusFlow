/**
 * State Transition Rules for Tasks (ITPM & Agile Work Units)
 * 
 * Business constraint demonstration:
 * A task follows a realistic software lifecycle:
 * - 'open' can be picked up -> 'in-progress', or dismissed -> 'closed'
 * - 'in-progress' can be completed -> 'resolved', put on hold -> 'open', or rejected -> 'closed'
 * - 'resolved' can be verified -> 'closed', or failed verification -> 'in-progress'.
 *   CRITICAL RULE: 'resolved' CANNOT jump straight back to 'open'. It requires rework ('in-progress').
 * - 'closed' can only be reopened directly to 'in-progress' for review.
 */

export const TASK_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];

export const ALLOWED_TRANSITIONS = {
  [TASK_STATUSES.OPEN]: [
    TASK_STATUSES.IN_PROGRESS,
    TASK_STATUSES.CLOSED,
  ],
  [TASK_STATUSES.IN_PROGRESS]: [
    TASK_STATUSES.RESOLVED,
    TASK_STATUSES.OPEN,
    TASK_STATUSES.CLOSED,
  ],
  [TASK_STATUSES.RESOLVED]: [
    TASK_STATUSES.CLOSED,
    TASK_STATUSES.IN_PROGRESS, // Failed QA / rework needed, CANNOT jump back to 'open' directly!
  ],
  [TASK_STATUSES.CLOSED]: [
    TASK_STATUSES.IN_PROGRESS, // Reopened task requires active progress
  ],
};

// Aliases for backwards compatibility
export const ISSUE_STATUSES = TASK_STATUSES;
export const ISSUE_PRIORITIES = TASK_PRIORITIES;

/**
 * Validates whether transition from currentStatus to targetStatus is permitted.
 */
export function isValidTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(targetStatus));
}

/**
 * Returns list of allowed next statuses for UI action buttons
 */
export function getAllowedTransitions(currentStatus) {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
}

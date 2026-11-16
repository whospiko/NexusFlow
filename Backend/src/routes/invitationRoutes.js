import express from 'express';
import {
  inviteMember,
  getProjectMembers,
  getProjectPendingInvitations,
  resendInvitation,
  cancelInvitation,
  getInvitationByToken,
  acceptInvitation,
} from '../controllers/invitationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Project-scoped invitation endpoints
router.post('/projects/:projectId/invitations', authenticateToken, inviteMember);
router.get('/projects/:projectId/members', authenticateToken, getProjectMembers);
router.get('/projects/:projectId/invitations', authenticateToken, getProjectPendingInvitations);
router.post('/projects/:projectId/invitations/:invitationId/resend', authenticateToken, resendInvitation);
router.delete('/projects/:projectId/invitations/:invitationId', authenticateToken, cancelInvitation);

// General invitation endpoints (token-based inspection & acceptance)
router.get('/invitations/:token', getInvitationByToken);
router.post('/invitations/accept', authenticateToken, acceptInvitation);

export default router;

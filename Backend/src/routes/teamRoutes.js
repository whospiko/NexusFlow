import { Router } from 'express';
import { getTeams, removeMember } from '../controllers/teamController.js';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// /api/teams - List scoped project teams
router.get('/', optionalAuth, getTeams);

// /api/teams/:projectId/members/:userId - Remove member from specific project team
router.delete('/:projectId/members/:userId', authenticateToken, removeMember);

export default router;

import { Router } from 'express';
import {
  getProjectRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  linkTaskToRequirement,
  unlinkTaskFromRequirement,
} from '../controllers/requirementController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Project-level requirements endpoints
router.get('/projects/:projectId/requirements', optionalAuth, getProjectRequirements);
router.post('/projects/:projectId/requirements', optionalAuth, createRequirement);

// Single requirement management endpoints
router.put('/requirements/:id', optionalAuth, updateRequirement);
router.delete('/requirements/:id', optionalAuth, deleteRequirement);

// Traceability task linking endpoints
router.post('/requirements/:id/tasks', optionalAuth, linkTaskToRequirement);
router.delete('/requirements/:id/tasks/:taskId', optionalAuth, unlinkTaskFromRequirement);

export default router;


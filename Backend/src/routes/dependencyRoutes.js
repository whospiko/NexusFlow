import { Router } from 'express';
import {
  getProjectDependencies,
  createDependency,
  deleteDependency,
  getTaskDependencies,
} from '../controllers/dependencyController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Project-level ITPM task dependency routes
router.get('/projects/:projectId/dependencies', optionalAuth, getProjectDependencies);
router.post('/projects/:projectId/dependencies', optionalAuth, createDependency);

// Single dependency resource operations
router.delete('/dependencies/:id', optionalAuth, deleteDependency);

// Single task & issue incoming/outgoing dependency links
router.get('/tasks/:taskId/dependencies', optionalAuth, getTaskDependencies);
router.get('/issues/:issueId/dependencies', optionalAuth, getTaskDependencies);

export default router;

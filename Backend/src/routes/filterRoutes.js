import { Router } from 'express';
import { getFilteredTasks } from '../controllers/filterController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// /api/filters/tasks & /api/filters/issues
router.get('/tasks', optionalAuth, getFilteredTasks);
router.get('/issues', optionalAuth, getFilteredTasks);

export default router;

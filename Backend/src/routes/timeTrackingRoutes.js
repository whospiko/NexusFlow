import { Router } from 'express';
import {
  getProjectGantt,
  getProjectTimesheets,
  getProjectWorkload,
  createTimeLog,
  getTimeLogsByTask,
  deleteTimeLog,
} from '../controllers/timeTrackingController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Project-scoped views (Gantt timeline, Timesheets, Workload capacity)
router.get('/projects/:projectId/gantt', optionalAuth, getProjectGantt);
router.get('/projects/:projectId/timesheets', optionalAuth, getProjectTimesheets);
router.get('/projects/:projectId/workload', optionalAuth, getProjectWorkload);

// Task-scoped & Issue-scoped work log endpoints
router.get('/tasks/:taskId/time-logs', optionalAuth, getTimeLogsByTask);
router.post('/tasks/:taskId/time-logs', optionalAuth, createTimeLog);
router.get('/issues/:issueId/time-logs', optionalAuth, getTimeLogsByTask);
router.post('/issues/:issueId/time-logs', optionalAuth, createTimeLog);
router.delete('/time-logs/:id', optionalAuth, deleteTimeLog);

export default router;

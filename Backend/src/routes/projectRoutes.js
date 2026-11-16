import { Router } from 'express';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
} from '../controllers/projectController.js';
import {
  getTasksByProject,
  createTask,
} from '../controllers/taskController.js';
import {
  getProjectVersions,
  createProjectVersion,
  getProjectVersionById,
  restoreProjectVersion,
  deleteProjectVersion,
} from '../controllers/versionController.js';
import { optionalAuth, authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// Project resource endpoints
router.route('/')
  .get(optionalAuth, getProjects)
  .post(optionalAuth, createProject);

router.route('/:id')
  .get(optionalAuth, getProjectById)
  .put(authenticateToken, updateProject)
  .delete(authenticateToken, deleteProject);

// Duplicate Project (Clone as a template)
router.post('/:id/duplicate', optionalAuth, duplicateProject);

// Version History & Snapshots (v1.0, v1.1, etc.)
router.route('/:projectId/versions')
  .get(optionalAuth, getProjectVersions)
  .post(optionalAuth, createProjectVersion);

router.route('/:projectId/versions/:versionId')
  .get(optionalAuth, getProjectVersionById)
  .delete(optionalAuth, deleteProjectVersion);

router.post('/:projectId/versions/:versionId/restore', optionalAuth, restoreProjectVersion);

// Nested RESTful routes: /api/projects/:projectId/tasks & /api/projects/:projectId/issues
router.route('/:projectId/tasks')
  .get(optionalAuth, getTasksByProject)
  .post(optionalAuth, createTask);

router.route('/:projectId/issues')
  .get(optionalAuth, getTasksByProject)
  .post(optionalAuth, createTask);

export default router;

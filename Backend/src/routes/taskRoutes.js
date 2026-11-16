import { Router } from 'express';
import {
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskActivities,
} from '../controllers/taskController.js';
import {
  getCommentsByTask,
  createComment,
} from '../controllers/commentController.js';
import {
  getIssueTags,
  attachTag,
  removeTag,
} from '../controllers/tagController.js';
import {
  getTaskDependencies,
} from '../controllers/dependencyController.js';
import {
  getTimeLogsByTask,
  createTimeLog,
} from '../controllers/timeTrackingController.js';

const router = Router();

// Single task resource endpoints
router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .patch(updateTask)
  .delete(deleteTask);

// Dedicated state transition endpoint validating business state machine
router.patch('/:id/status', updateTaskStatus);

// Activity audit log timeline for task
router.get('/:id/activities', getTaskActivities);

// Nested RESTful routes: /api/tasks/:taskId/comments
router.route('/:taskId/comments')
  .get(getCommentsByTask)
  .post(createComment);

// Nested RESTful routes: /api/tasks/:taskId/tags (Many-to-Many association)
router.route('/:taskId/tags')
  .get(getIssueTags)
  .post(attachTag);

router.delete('/:taskId/tags/:tagId', removeTag);

// Nested RESTful routes: /api/tasks/:taskId/dependencies
router.get('/:taskId/dependencies', getTaskDependencies);

// Nested RESTful routes: /api/tasks/:taskId/time-logs
router.route('/:taskId/time-logs')
  .get(getTimeLogsByTask)
  .post(createTimeLog);

export default router;


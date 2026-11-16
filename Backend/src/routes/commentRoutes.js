import { Router } from 'express';
import { updateComment, deleteComment } from '../controllers/commentController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// /api/comments/:id
router.route('/:id')
  .put(optionalAuth, updateComment)
  .delete(optionalAuth, deleteComment);

export default router;

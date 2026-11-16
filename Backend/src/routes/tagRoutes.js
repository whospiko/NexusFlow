import { Router } from 'express';
import { getTags, createTagHandler } from '../controllers/tagController.js';

const router = Router();

// /api/tags
router.route('/')
  .get(getTags)
  .post(createTagHandler);

export default router;


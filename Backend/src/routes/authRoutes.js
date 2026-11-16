import express from 'express';
import {
  initiateGoogleOAuth,
  handleGoogleCallback,
  initiateGithubOAuth,
  handleGithubCallback,
  devLogin,
  getAuthUsers,
  getCurrentUser,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Google OAuth
router.get('/google', initiateGoogleOAuth);
router.get('/google/callback', handleGoogleCallback);

// GitHub OAuth
router.get('/github', initiateGithubOAuth);
router.get('/github/callback', handleGithubCallback);

// Dev / Demo Authentication
router.post('/dev-login', devLogin);
router.get('/users', getAuthUsers);

// Current User Profile
router.get('/me', authenticateToken, getCurrentUser);

export default router;


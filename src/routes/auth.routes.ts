// Authentication routes
import { Router } from 'express';
import passport from 'passport';
import {
  googleAuthCallback,
  microsoftAuthCallback,
  logout,
  getCurrentUser,
} from '../controllers/auth.controller';

const router = Router();

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  googleAuthCallback
);

// Microsoft OAuth routes
router.get(
  '/microsoft',
  passport.authenticate('microsoft', { scope: ['user.read'] })
);

router.get(
  '/microsoft/callback',
  passport.authenticate('microsoft', { failureRedirect: '/login' }),
  microsoftAuthCallback
);

// Common auth routes
router.post('/logout', logout);
router.get('/me', getCurrentUser);

export default router;

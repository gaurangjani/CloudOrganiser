// Authentication routes
import { Router } from 'express';
import passport from 'passport';
import {
  googleAuthCallback,
  microsoftAuthCallback,
  logout,
  getCurrentUser,
  refreshToken,
  disconnect,
} from '../controllers/auth.controller';

const router = Router();

// Google OAuth routes
// accessType: 'offline' + prompt: 'consent' ensure we receive a refresh token
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    accessType: 'offline',
    prompt: 'consent',
  } as Parameters<typeof passport.authenticate>[1])
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

// Token management routes
router.post('/refresh', refreshToken);
router.post('/disconnect', disconnect);

export default router;

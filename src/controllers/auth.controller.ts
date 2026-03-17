// Authentication controller for OAuth
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware';
import { ApiError } from '../middleware/ApiError';
import { tokenService } from '../services/TokenService';
import { User } from '../types/user.types';

export const googleAuthCallback = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      status: 'success',
      message: 'Google authentication successful',
      user: req.user,
    });
  }
);

export const microsoftAuthCallback = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      status: 'success',
      message: 'Microsoft authentication successful',
      user: req.user,
    });
  }
);

export const logout = (req: Request, res: Response): void => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({
        status: 'error',
        message: 'Logout failed',
      });
      return;
    }
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  });
};

export const getCurrentUser = (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      message: 'Not authenticated',
    });
    return;
  }

  res.status(200).json({
    status: 'success',
    user: req.user,
  });
};

/**
 * POST /auth/refresh
 * Body: { provider: 'google' | 'microsoft' }
 * Refreshes the access token for the authenticated user's chosen provider
 * and returns the new token details.
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const { provider } = req.body as { provider?: string };
    if (provider !== 'google' && provider !== 'microsoft') {
      throw ApiError.badRequest('provider must be "google" or "microsoft"');
    }

    const user = req.user as User;
    const result = await tokenService.refreshAccessToken(user.id, provider);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  }
);

/**
 * POST /auth/disconnect
 * Body: { provider: 'google' | 'microsoft' }
 * Revokes the stored tokens for the authenticated user's chosen provider.
 */
export const disconnect = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const { provider } = req.body as { provider?: string };
    if (provider !== 'google' && provider !== 'microsoft') {
      throw ApiError.badRequest('provider must be "google" or "microsoft"');
    }

    const user = req.user as User;
    const revoked = await tokenService.revokeTokens(user.id, provider);

    if (!revoked) {
      throw ApiError.notFound(`No token connection found for provider "${provider}"`);
    }

    res.status(200).json({
      status: 'success',
      message: `Disconnected from ${provider}`,
    });
  }
);

// Authentication controller for OAuth
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware';

export const googleAuthCallback = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // OAuth callback will be handled by passport middleware
    // This is where you'd create/update user session
    res.status(200).json({
      status: 'success',
      message: 'Google authentication successful',
      user: req.user,
    });
  }
);

export const microsoftAuthCallback = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // OAuth callback will be handled by passport middleware
    // This is where you'd create/update user session
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

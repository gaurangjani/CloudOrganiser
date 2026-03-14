// Passport configuration for OAuth
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { config } from '../config';
import { logger } from '../config/logger';
import { User, OAuthProfile } from '../types/user.types';

// Serialize user to session
passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Google OAuth Strategy
if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.oauth.google.clientId,
        clientSecret: config.oauth.google.clientSecret,
        callbackURL: config.oauth.google.callbackUrl,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: OAuthProfile,
        done: (error: Error | null, user?: User | false) => void
      ) => {
        try {
          // In a real application, you would:
          // 1. Check if user exists in database
          // 2. Create new user if doesn't exist
          // 3. Update user info if exists

          const user: User = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName,
            provider: 'google',
            providerId: profile.id,
            avatar: profile.photos?.[0]?.value,
            createdAt: new Date(),
          };

          logger.info(`Google OAuth successful for user: ${user.email}`);
          return done(null, user);
        } catch (error) {
          logger.error('Google OAuth error:', error);
          return done(error as Error);
        }
      }
    )
  );
  logger.info('Google OAuth strategy configured');
} else {
  logger.warn('Google OAuth not configured - missing credentials');
}

// Microsoft OAuth Strategy
if (config.oauth.microsoft.clientId && config.oauth.microsoft.clientSecret) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: config.oauth.microsoft.clientId,
        clientSecret: config.oauth.microsoft.clientSecret,
        callbackURL: config.oauth.microsoft.callbackUrl,
        scope: ['user.read'],
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: OAuthProfile,
        done: (error: Error | null, user?: User | false) => void
      ) => {
        try {
          // In a real application, you would:
          // 1. Check if user exists in database
          // 2. Create new user if doesn't exist
          // 3. Update user info if exists

          const user: User = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName,
            provider: 'microsoft',
            providerId: profile.id,
            avatar: profile.photos?.[0]?.value,
            createdAt: new Date(),
          };

          logger.info(`Microsoft OAuth successful for user: ${user.email}`);
          return done(null, user);
        } catch (error) {
          logger.error('Microsoft OAuth error:', error);
          return done(error as Error);
        }
      }
    )
  );
  logger.info('Microsoft OAuth strategy configured');
} else {
  logger.warn('Microsoft OAuth not configured - missing credentials');
}

export default passport;

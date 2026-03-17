// Unit tests for the auth controller (refreshToken and disconnect endpoints)
import request from 'supertest';
import express, { Application } from 'express';
import authRoutes from '../routes/auth.routes';
import { tokenService } from '../services/TokenService';

// Mock config to avoid Joi validation on real env vars
jest.mock('../config', () => ({
  config: {
    env: 'test',
    port: 3000,
    apiVersion: 'v1',
    logging: { level: 'info' },
    cors: { origin: '*' },
    rateLimit: { windowMs: 900000, maxRequests: 100 },
    session: { secret: 'test-secret' },
    tokenEncryptionKey: 'test-token-encryption-key-32-chars!!',
    oauth: {
      google: {
        clientId: 'test-google-client-id',
        clientSecret: 'test-google-client-secret',
        callbackUrl: 'http://localhost:3000/auth/google/callback',
      },
      microsoft: {
        clientId: 'test-microsoft-client-id',
        clientSecret: 'test-microsoft-client-secret',
        callbackUrl: 'http://localhost:3000/auth/microsoft/callback',
      },
    },
  },
}));

// Mock passport so OAuth redirect routes don't fail
jest.mock('../config/passport', () => {
  const passMock = {
    initialize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    session: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    authenticate: (_strategy: string, _opts?: unknown) =>
      (_req: unknown, _res: unknown, next: () => void) => next(),
    serializeUser: jest.fn(),
    deserializeUser: jest.fn(),
  };
  return { default: passMock, __esModule: true };
});

// Mock TokenService
jest.mock('../services/TokenService', () => ({
  tokenService: {
    refreshAccessToken: jest.fn(),
    revokeTokens: jest.fn(),
    storeTokens: jest.fn(),
    getTokens: jest.fn(),
  },
}));

// Mock logger
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Middleware that injects a fake authenticated user into req.user
const withUser = (userId = 'user-123') =>
  (req: express.Request, _res: express.Response, next: express.NextFunction): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).user = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      provider: 'google',
      providerId: userId,
      createdAt: new Date(),
    };
    next();
  };

function buildApp(authenticated = true): Application {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use(withUser());
  }
  // Mount routes under the same prefix used in tests
  app.use('/api/v1/auth', authRoutes);
  // Simple error handler so ApiError responses are JSON
  app.use(
    (
      err: { statusCode?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(err.statusCode ?? 500).json({ status: 'error', message: err.message });
    }
  );
  return app;
}

describe('Auth Controller – refreshToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 and the new token info on success', async () => {
    const mockResult = {
      accessToken: 'new-access-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      scope: 'email profile',
    };
    (tokenService.refreshAccessToken as jest.Mock).mockResolvedValue(mockResult);

    const res = await request(buildApp())
      .post('/api/v1/auth/refresh')
      .send({ provider: 'google' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBe('new-access-token');
    expect(tokenService.refreshAccessToken).toHaveBeenCalledWith('user-123', 'google');
  });

  it('returns 200 for microsoft provider', async () => {
    (tokenService.refreshAccessToken as jest.Mock).mockResolvedValue({
      accessToken: 'ms-new-token',
    });

    const res = await request(buildApp())
      .post('/api/v1/auth/refresh')
      .send({ provider: 'microsoft' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('ms-new-token');
    expect(tokenService.refreshAccessToken).toHaveBeenCalledWith('user-123', 'microsoft');
  });

  it('returns 401 when user is not authenticated', async () => {
    const res = await request(buildApp(false))
      .post('/api/v1/auth/refresh')
      .send({ provider: 'google' });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  it('returns 400 for an invalid provider value', async () => {
    const res = await request(buildApp())
      .post('/api/v1/auth/refresh')
      .send({ provider: 'dropbox' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('returns 400 when provider is missing', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(400);
  });

  it('propagates tokenService errors as 500', async () => {
    (tokenService.refreshAccessToken as jest.Mock).mockRejectedValue(
      new Error('No refresh token available')
    );

    const res = await request(buildApp())
      .post('/api/v1/auth/refresh')
      .send({ provider: 'google' });

    expect(res.status).toBe(500);
  });
});

describe('Auth Controller – disconnect', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on successful revocation', async () => {
    (tokenService.revokeTokens as jest.Mock).mockResolvedValue(true);

    const res = await request(buildApp())
      .post('/api/v1/auth/disconnect')
      .send({ provider: 'google' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toContain('google');
    expect(tokenService.revokeTokens).toHaveBeenCalledWith('user-123', 'google');
  });

  it('returns 200 when disconnecting microsoft', async () => {
    (tokenService.revokeTokens as jest.Mock).mockResolvedValue(true);

    const res = await request(buildApp())
      .post('/api/v1/auth/disconnect')
      .send({ provider: 'microsoft' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('microsoft');
  });

  it('returns 404 when no tokens exist for the provider', async () => {
    (tokenService.revokeTokens as jest.Mock).mockResolvedValue(false);

    const res = await request(buildApp())
      .post('/api/v1/auth/disconnect')
      .send({ provider: 'google' });

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });

  it('returns 401 when user is not authenticated', async () => {
    const res = await request(buildApp(false))
      .post('/api/v1/auth/disconnect')
      .send({ provider: 'google' });

    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid provider value', async () => {
    const res = await request(buildApp())
      .post('/api/v1/auth/disconnect')
      .send({ provider: 'onedrive' });

    expect(res.status).toBe(400);
  });
});

describe('Auth Controller – existing endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /me', () => {
    it('returns 200 with the user when authenticated', async () => {
      const res = await request(buildApp()).get('/api/v1/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.user.id).toBe('user-123');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(buildApp(false)).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });
});

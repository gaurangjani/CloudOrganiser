// Jest setup file to configure test environment

// Set required environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.SESSION_SECRET = 'test-session-secret';

// OAuth credentials (mock values for testing)
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';

process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.MICROSOFT_CALLBACK_URL = 'http://localhost:3000/auth/microsoft/callback';

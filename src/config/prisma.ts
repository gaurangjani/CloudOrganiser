// Prisma client singleton
// Instantiates PrismaClient once and reuses it across the application.
// In development, the instance is attached to the global object to prevent
// exhausting the database connection limit during hot-reloads.

import { PrismaClient } from '../generated/prisma/client';

declare global {
  // Allow `globalThis.__prisma` without TypeScript errors
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

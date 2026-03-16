import { randomUUID } from 'crypto';

/**
 * Generates a RFC 4122 v4 UUID using the Node.js crypto module.
 * Node.js >= 14.17.0 is required.
 */
export function v4(): string {
  return randomUUID();
}

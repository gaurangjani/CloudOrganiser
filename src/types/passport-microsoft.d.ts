// Type definitions for passport-microsoft
declare module 'passport-microsoft' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface MicrosoftStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
  }

  export interface Profile {
    id: string;
    displayName: string;
    name?: {
      familyName?: string;
      givenName?: string;
    };
    emails?: Array<{
      value: string;
      type?: string;
    }>;
    photos?: Array<{
      value: string;
    }>;
    provider: string;
    _raw?: string;
    _json?: Record<string, unknown>;
  }

  export type VerifyCallback = (
    error: Error | null,
    user?: Express.User | false,
    info?: unknown
  ) => void;

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ) => void | Promise<void>;

  export class Strategy extends PassportStrategy {
    constructor(options: MicrosoftStrategyOptions, verify: VerifyFunction);
    name: string;
    authenticate(req: Express.Request, options?: unknown): void;
  }
}

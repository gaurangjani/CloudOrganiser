// User type definition
export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'microsoft';
  providerId: string;
  avatar?: string;
  createdAt: Date;
}

// OAuth profile type
export interface OAuthProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  provider: string;
}

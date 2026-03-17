// Service for managing OAuth tokens: store, retrieve, refresh, and revoke.
import { google } from 'googleapis';
import { OAuthTokenModel, encryptToken, decryptToken } from '../models/oauth-token.model';
import { config, MICROSOFT_OAUTH_SCOPES } from '../config';
import { logger } from '../config/logger';
import { StoredOAuthToken, TokenRefreshResult } from '../types/user.types';

export class TokenService {
  /**
   * Persist (upsert) access and refresh tokens for a user+provider pair.
   */
  async storeTokens(
    userId: string,
    provider: 'google' | 'microsoft',
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    scope?: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      encryptedAccessToken: encryptToken(accessToken),
      expiresAt,
      scope,
    };

    if (refreshToken) {
      update.encryptedRefreshToken = encryptToken(refreshToken);
    }

    await OAuthTokenModel.findOneAndUpdate(
      { userId, provider },
      { $set: update },
      { upsert: true, new: true }
    );

    logger.info(`Stored OAuth tokens for user ${userId} (${provider})`);
  }

  /**
   * Retrieve decrypted token info for a user+provider pair.
   * Returns null when no token record exists.
   */
  async getTokens(
    userId: string,
    provider: 'google' | 'microsoft'
  ): Promise<StoredOAuthToken | null> {
    const doc = await OAuthTokenModel.findOne({ userId, provider });
    if (!doc) return null;

    return {
      userId: doc.userId,
      provider: doc.provider,
      accessToken: decryptToken(doc.encryptedAccessToken),
      refreshToken: doc.encryptedRefreshToken
        ? decryptToken(doc.encryptedRefreshToken)
        : undefined,
      expiresAt: doc.expiresAt,
      scope: doc.scope,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Delete all tokens for a user+provider pair (disconnect).
   */
  async revokeTokens(
    userId: string,
    provider: 'google' | 'microsoft'
  ): Promise<boolean> {
    const result = await OAuthTokenModel.findOneAndDelete({ userId, provider });
    if (result) {
      logger.info(`Revoked OAuth tokens for user ${userId} (${provider})`);
    }
    return result !== null;
  }

  /**
   * Refresh an access token using the stored refresh token.
   * Updates the stored tokens and returns the new access token info.
   */
  async refreshAccessToken(
    userId: string,
    provider: 'google' | 'microsoft'
  ): Promise<TokenRefreshResult> {
    const stored = await this.getTokens(userId, provider);

    if (!stored) {
      throw new Error(`No tokens found for user ${userId} (${provider})`);
    }

    if (!stored.refreshToken) {
      throw new Error(`No refresh token available for user ${userId} (${provider})`);
    }

    if (provider === 'google') {
      return this.refreshGoogleToken(userId, stored.refreshToken);
    }

    return this.refreshMicrosoftToken(userId, stored.refreshToken);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async refreshGoogleToken(
    userId: string,
    refreshToken: string
  ): Promise<TokenRefreshResult> {
    const oauth2Client = new google.auth.OAuth2(
      config.oauth.google.clientId,
      config.oauth.google.clientSecret,
      config.oauth.google.callbackUrl
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const newAccessToken = credentials.access_token;
    if (!newAccessToken) {
      throw new Error('Google token refresh did not return a new access token');
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : undefined;

    // Persist updated tokens; keep the same refresh token unless Google rotated it
    await this.storeTokens(
      userId,
      'google',
      newAccessToken,
      credentials.refresh_token ?? refreshToken,
      expiresAt,
      credentials.scope ?? undefined
    );

    logger.info(`Refreshed Google access token for user ${userId}`);

    return { accessToken: newAccessToken, expiresAt, scope: credentials.scope ?? undefined };
  }

  private async refreshMicrosoftToken(
    userId: string,
    refreshToken: string
  ): Promise<TokenRefreshResult> {
    const tokenEndpoint = `https://login.microsoftonline.com/common/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: MICROSOFT_OAUTH_SCOPES.join(' '),
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Microsoft token refresh failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    await this.storeTokens(
      userId,
      'microsoft',
      data.access_token,
      data.refresh_token ?? refreshToken,
      expiresAt,
      data.scope
    );

    logger.info(`Refreshed Microsoft access token for user ${userId}`);

    return {
      accessToken: data.access_token,
      expiresAt,
      scope: data.scope,
    };
  }
}

export const tokenService = new TokenService();

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  mcpServers,
  userMcpIntegrations,
  type McpServer,
  type UserMcpIntegration,
} from '@/lib/db/schema';
import { encrypt, decrypt } from '@/lib/services/tokenEncryption';

/**
 * MCP Integration Repository
 *
 * Handles database operations for MCP server configurations and user integrations.
 * Provides secure token handling with encryption/decryption.
 */

export class McpIntegrationRepository {
  /**
   * Gets all enabled MCP servers
   */
  static async getEnabledMcpServers(): Promise<McpServer[]> {
    return await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.isEnabled, true));
  }

  /**
   * Gets a specific MCP server by name
   */
  static async getMcpServerByName(name: string): Promise<McpServer | null> {
    const results = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.name, name))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Gets a specific MCP server by ID
   */
  static async getMcpServerById(id: string): Promise<McpServer | null> {
    const results = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Creates a new MCP server configuration
   */
  static async createMcpServer(
    serverData: Omit<McpServer, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<McpServer> {
    const [server] = await db.insert(mcpServers).values(serverData).returning();

    return server;
  }

  /**
   * Gets user's integration for a specific MCP server
   */
  static async getUserMcpIntegration(
    userId: string,
    mcpServerId: string,
  ): Promise<UserMcpIntegration | null> {
    const results = await db
      .select()
      .from(userMcpIntegrations)
      .where(
        and(
          eq(userMcpIntegrations.userId, userId),
          eq(userMcpIntegrations.mcpServerId, mcpServerId),
          eq(userMcpIntegrations.isActive, true),
        ),
      )
      .limit(1);

    return results[0] || null;
  }

  /**
   * Gets user's integration for a specific MCP server by name
   */
  static async getUserMcpIntegrationByServerName(
    userId: string,
    serverName: string,
  ): Promise<UserMcpIntegration | null> {
    const results = await db
      .select({
        userId: userMcpIntegrations.userId,
        mcpServerId: userMcpIntegrations.mcpServerId,
        accessToken: userMcpIntegrations.accessToken,
        refreshToken: userMcpIntegrations.refreshToken,
        expiresAt: userMcpIntegrations.expiresAt,
        scope: userMcpIntegrations.scope,
        isActive: userMcpIntegrations.isActive,
        createdAt: userMcpIntegrations.createdAt,
        updatedAt: userMcpIntegrations.updatedAt,
        lastUsedAt: userMcpIntegrations.lastUsedAt,
      })
      .from(userMcpIntegrations)
      .innerJoin(mcpServers, eq(userMcpIntegrations.mcpServerId, mcpServers.id))
      .where(
        and(
          eq(userMcpIntegrations.userId, userId),
          eq(mcpServers.name, serverName),
          eq(userMcpIntegrations.isActive, true),
        ),
      )
      .limit(1);

    return results[0] || null;
  }

  /**
   * Gets all active integrations for a user
   */
  static async getUserMcpIntegrations(
    userId: string,
  ): Promise<(UserMcpIntegration & { serverName: string })[]> {
    return await db
      .select({
        userId: userMcpIntegrations.userId,
        mcpServerId: userMcpIntegrations.mcpServerId,
        accessToken: userMcpIntegrations.accessToken,
        refreshToken: userMcpIntegrations.refreshToken,
        expiresAt: userMcpIntegrations.expiresAt,
        scope: userMcpIntegrations.scope,
        isActive: userMcpIntegrations.isActive,
        createdAt: userMcpIntegrations.createdAt,
        updatedAt: userMcpIntegrations.updatedAt,
        lastUsedAt: userMcpIntegrations.lastUsedAt,
        serverName: mcpServers.name,
      })
      .from(userMcpIntegrations)
      .innerJoin(mcpServers, eq(userMcpIntegrations.mcpServerId, mcpServers.id))
      .where(
        and(
          eq(userMcpIntegrations.userId, userId),
          eq(userMcpIntegrations.isActive, true),
        ),
      );
  }

  /**
   * Creates or updates a user's MCP integration with encrypted tokens
   */
  static async upsertUserMcpIntegration(
    userId: string,
    mcpServerId: string,
    tokenData: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
      scope?: string;
    },
  ): Promise<UserMcpIntegration> {
    const encryptedAccessToken = encrypt(tokenData.accessToken);
    const encryptedRefreshToken = tokenData.refreshToken
      ? encrypt(tokenData.refreshToken)
      : null;

    const [integration] = await db
      .insert(userMcpIntegrations)
      .values({
        userId,
        mcpServerId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokenData.expiresAt,
        scope: tokenData.scope,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [userMcpIntegrations.userId, userMcpIntegrations.mcpServerId],
        set: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: tokenData.expiresAt,
          scope: tokenData.scope,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    return integration;
  }

  /**
   * Gets decrypted access token for a user's integration
   */
  static async getDecryptedAccessToken(
    userId: string,
    mcpServerId: string,
  ): Promise<string | null> {
    const integration = await this.getUserMcpIntegration(userId, mcpServerId);
    if (!integration) return null;

    try {
      return decrypt(integration.accessToken);
    } catch (error) {
      console.error('Failed to decrypt access token:', error);
      return null;
    }
  }

  /**
   * Gets decrypted access token by server name
   */
  static async getDecryptedAccessTokenByServerName(
    userId: string,
    serverName: string,
  ): Promise<string | null> {
    const integration = await this.getUserMcpIntegrationByServerName(
      userId,
      serverName,
    );
    if (!integration) return null;

    try {
      return decrypt(integration.accessToken);
    } catch (error) {
      console.error('Failed to decrypt access token:', error);
      return null;
    }
  }

  /**
   * Updates last used timestamp for an integration
   */
  static async updateLastUsed(
    userId: string,
    mcpServerId: string,
  ): Promise<void> {
    await db
      .update(userMcpIntegrations)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userMcpIntegrations.userId, userId),
          eq(userMcpIntegrations.mcpServerId, mcpServerId),
        ),
      );
  }

  /**
   * Deactivates a user's MCP integration
   */
  static async deactivateUserMcpIntegration(
    userId: string,
    mcpServerId: string,
  ): Promise<void> {
    await db
      .update(userMcpIntegrations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userMcpIntegrations.userId, userId),
          eq(userMcpIntegrations.mcpServerId, mcpServerId),
        ),
      );
  }

  /**
   * Completely removes a user's MCP integration
   */
  static async deleteUserMcpIntegration(
    userId: string,
    mcpServerId: string,
  ): Promise<void> {
    await db
      .delete(userMcpIntegrations)
      .where(
        and(
          eq(userMcpIntegrations.userId, userId),
          eq(userMcpIntegrations.mcpServerId, mcpServerId),
        ),
      );
  }
}

// All functions are already exported individually above

// Export convenience functions for easier importing
export const getMcpServerByName = McpIntegrationRepository.getMcpServerByName;
export const getDecryptedAccessTokenByServerName =
  McpIntegrationRepository.getDecryptedAccessTokenByServerName;
export const upsertUserMcpIntegration =
  McpIntegrationRepository.upsertUserMcpIntegration;

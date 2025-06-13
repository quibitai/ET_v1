/**
 * Asana Configuration Management
 *
 * Loads and validates the configuration for the Asana integration
 * from environment variables.
 */

import { AsanaToolError } from './types';

export interface AsanaConfig {
  personalAccessToken: string;
  workspaceGid: string;
  apiBaseUrl: string;
  apiVersion: string;
  timeout: number;
  rateLimits: {
    requestsPerMinute: number;
  };
  features: {
    workflows: boolean;
    semanticResolution: boolean;
    errorRecovery: boolean;
    responseEnhancement: boolean;
  };
}

let cachedConfig: AsanaConfig | null = null;

/**
 * Loads Asana configuration from environment variables and caches it.
 * Throws AsanaToolError if required environment variables are missing.
 * @returns The validated Asana configuration.
 */
export function getAsanaConfig(): AsanaConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const personalAccessToken = process.env.ASANA_PAT;
  const workspaceGid = process.env.ASANA_WORKSPACE_GID;

  if (!personalAccessToken) {
    throw new AsanaToolError(
      'ASANA_PAT environment variable is missing',
      'CONFIG_ERROR',
      500,
    );
  }

  if (!workspaceGid) {
    throw new AsanaToolError(
      'ASANA_WORKSPACE_GID environment variable is missing',
      'CONFIG_ERROR',
      500,
    );
  }

  cachedConfig = {
    personalAccessToken,
    workspaceGid,
    apiBaseUrl: 'https://app.asana.com/api',
    apiVersion: '1.0',
    timeout: 30000,
    rateLimits: {
      requestsPerMinute: 1500,
    },
    features: {
      workflows: true,
      semanticResolution: true,
      errorRecovery: true,
      responseEnhancement: true,
    },
  };

  return cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}

/**
 * Validate configuration completeness
 */
export function validateConfig(config: AsanaConfig): void {
  const required = ['personalAccessToken', 'workspaceGid', 'apiBaseUrl'];

  for (const field of required) {
    if (!config[field as keyof AsanaConfig]) {
      throw new Error(`Required configuration field '${field}' is missing`);
    }
  }

  if (config.timeout <= 0) {
    throw new Error('Timeout must be positive');
  }
}

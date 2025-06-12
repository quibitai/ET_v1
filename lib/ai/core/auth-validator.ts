/**
 * Core Authentication Validator
 *
 * Validates all required API keys on application startup
 * Following fail-fast principle for configuration errors
 */

export interface AuthValidationResult {
  service: string;
  valid: boolean;
  error?: string;
}

const REQUIRED_KEYS = {
  OPENAI_API_KEY: {
    pattern: /^sk-proj-.{97,}$/,
    description: 'OpenAI API key (project-based format)',
  },
  ASANA_PAT: {
    pattern: /^[0-9]/,
    description: 'Asana Personal Access Token',
  },
};

/**
 * Internal key validation method
 */
function validateKey(
  keyName: string,
  config: { pattern: RegExp; description: string },
): void {
  const value = process.env[keyName];

  if (!value) {
    throw new Error(`${keyName} environment variable is required`);
  }

  if (!config.pattern.test(value)) {
    throw new Error(
      `${keyName} format is invalid. Expected: ${config.description}`,
    );
  }
}

/**
 * Validate all required API keys
 * Throws on first validation failure for fail-fast behavior
 */
export function validateAll(): AuthValidationResult[] {
  const results: AuthValidationResult[] = [];

  for (const [keyName, config] of Object.entries(REQUIRED_KEYS)) {
    try {
      validateKey(keyName, config);
      results.push({
        service: keyName,
        valid: true,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        service: keyName,
        valid: false,
        error: errorMsg,
      });

      // Fail fast - throw on first error
      throw new AuthValidationError(
        `Authentication validation failed for ${keyName}: ${errorMsg}`,
        keyName,
        results,
      );
    }
  }

  return results;
}

/**
 * Validate OpenAI API key specifically
 */
export function validateOpenAI(): void {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error('OPENAI_API_KEY environment variable is missing');
  }

  if (key.includes('*') || key.length < 100) {
    throw new Error(
      'OPENAI_API_KEY appears to be corrupted, truncated, or placeholder',
    );
  }

  if (!key.startsWith('sk-proj-')) {
    throw new Error(
      'OPENAI_API_KEY must use project-based format (sk-proj-...)',
    );
  }

  if (key.endsWith('7i0A')) {
    throw new Error(
      'OPENAI_API_KEY appears to be truncated - regenerate from OpenAI dashboard',
    );
  }
}

/**
 * Validate Asana Personal Access Token
 */
export function validateAsana(): void {
  const key = process.env.ASANA_PAT;

  if (!key) {
    throw new Error('ASANA_PAT environment variable is missing');
  }

  if (key.length < 32) {
    throw new Error('ASANA_PAT appears to be too short or invalid');
  }
}

/**
 * Get validation status without throwing
 */
export function getValidationStatus(): AuthValidationResult[] {
  try {
    return validateAll();
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return error.results;
    }

    return [
      {
        service: 'unknown',
        valid: false,
        error:
          error instanceof Error ? error.message : 'Unknown validation error',
      },
    ];
  }
}

/**
 * Custom error for authentication validation failures
 */
export class AuthValidationError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly results: AuthValidationResult[],
  ) {
    super(message);
    this.name = 'AuthValidationError';
  }
}

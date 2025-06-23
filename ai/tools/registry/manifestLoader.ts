/**
 * Manifest Loader
 *
 * Loads and validates tool manifests from the filesystem.
 * Includes caching, validation, and file watching capabilities.
 * This is a non-intrusive addition that doesn't affect streaming.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type {
  ToolManifest,
  ManifestCollection,
  ManifestValidationResult,
  ToolRegistryConfig,
} from './types';

/**
 * Zod schema for manifest validation
 */
const toolManifestSchema = z.object({
  id: z.string().min(1),
  service: z.string().min(1),
  streamingSupported: z.boolean(),
  category: z.enum([
    'project_management',
    'task_management',
    'team_operations',
    'analytics',
    'communication',
    'general',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  description: z.string().min(1),
  estimatedDuration: z.number().positive().optional(),
  batchCompatible: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  requiredScopes: z.array(z.string()).optional(),
  manifestVersion: z.string().optional(),
});

/**
 * Manifest loader with caching and validation
 */
export class ManifestLoader {
  private cache: ManifestCollection | null = null;
  private cacheTimestamp = 0;
  private config: Required<ToolRegistryConfig>;

  constructor(config: ToolRegistryConfig = {}) {
    this.config = {
      manifestPath: config.manifestPath || 'config/mcp/manifests',
      enableCaching: config.enableCaching !== false,
      cacheTTL: config.cacheTTL || 5 * 60 * 1000, // 5 minutes default
      watchForChanges: config.watchForChanges || false,
      validateOnLoad: config.validateOnLoad !== false,
    };
  }

  /**
   * Load all manifests from the filesystem
   */
  async loadManifests(): Promise<ManifestCollection> {
    // Check cache first
    if (this.config.enableCaching && this.cache && this.isCacheValid()) {
      return this.cache;
    }

    const manifests: ManifestCollection = {};

    try {
      const rootDir = path.resolve(process.cwd(), this.config.manifestPath);
      const services = await this.getDirectories(rootDir);

      for (const service of services) {
        manifests[service] = {};
        const serviceDir = path.join(rootDir, service);
        const files = await this.getJsonFiles(serviceDir);

        for (const file of files) {
          const filePath = path.join(serviceDir, file);
          const manifest = await this.loadManifestFile(filePath);

          if (manifest) {
            manifests[service][manifest.id] = manifest;
          }
        }
      }

      // Update cache
      if (this.config.enableCaching) {
        this.cache = manifests;
        this.cacheTimestamp = Date.now();
      }

      return manifests;
    } catch (error) {
      // If manifests directory doesn't exist, return empty collection
      if ((error as any).code === 'ENOENT') {
        console.warn(
          `Manifest directory not found: ${this.config.manifestPath}`,
        );
        return {};
      }
      throw error;
    }
  }

  /**
   * Load a single manifest file
   */
  private async loadManifestFile(
    filePath: string,
  ): Promise<ToolManifest | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (this.config.validateOnLoad) {
        const validation = this.validateManifest(data);
        if (!validation.isValid) {
          console.error(`Invalid manifest at ${filePath}:`, validation.errors);
          return null;
        }
      }

      return data as ToolManifest;
    } catch (error) {
      console.error(`Error loading manifest ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Validate a manifest against the schema
   */
  validateManifest(data: unknown): ManifestValidationResult {
    try {
      toolManifestSchema.parse(data);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return {
        isValid: false,
        errors: ['Unknown validation error'],
      };
    }
  }

  /**
   * Get a specific manifest by service and tool ID
   */
  async getManifest(
    service: string,
    toolId: string,
  ): Promise<ToolManifest | null> {
    const manifests = await this.loadManifests();
    return manifests[service]?.[toolId] || null;
  }

  /**
   * Get all manifests for a service
   */
  async getServiceManifests(
    service: string,
  ): Promise<Record<string, ToolManifest>> {
    const manifests = await this.loadManifests();
    return manifests[service] || {};
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.config.cacheTTL;
  }

  /**
   * Get directories in a path
   */
  private async getDirectories(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Get JSON files in a directory
   */
  private async getJsonFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.filter((file) => file.endsWith('.json'));
    } catch {
      return [];
    }
  }

  /**
   * Watch for manifest changes (development mode)
   */
  async watchForChanges(callback: () => void): Promise<void> {
    if (!this.config.watchForChanges) {
      return;
    }

    // Note: In production, we would use a proper file watcher
    // For MVP, we'll skip this feature to avoid complexity
    console.log('File watching not implemented in MVP version');
  }
}

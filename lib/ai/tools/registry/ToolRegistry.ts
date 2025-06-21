/**
 * Tool Registry
 *
 * Enhances existing tool loading with manifest metadata.
 * This is an additive layer that preserves all existing functionality
 * while providing richer tool discovery and categorization.
 *
 * CRITICAL: This does NOT modify the streaming pipeline.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { ManifestLoader } from './manifestLoader';
import type { ToolManifest, EnrichedTool, ToolRegistryConfig } from './types';

/**
 * Enhanced tool registry with manifest support
 */
export class ToolRegistry {
  private manifestLoader: ManifestLoader;

  constructor(config: ToolRegistryConfig = {}) {
    this.manifestLoader = new ManifestLoader(config);
  }

  /**
   * Enhance existing tools with manifest metadata
   * This is additive only - it does not modify the original tools
   */
  async enrichToolsWithManifests(
    tools: DynamicStructuredTool[],
  ): Promise<EnrichedTool[]> {
    // Load all manifests
    const manifests = await this.manifestLoader.loadManifests();

    // Map tools to enriched tools
    const enrichedTools: EnrichedTool[] = [];

    for (const tool of tools) {
      // Try to find matching manifest
      let manifest: ToolManifest | undefined;

      // Search all services for matching tool ID
      for (const service of Object.keys(manifests)) {
        if (manifests[service][tool.name]) {
          manifest = manifests[service][tool.name];
          break;
        }
      }

      // Create enriched tool
      const enrichedTool: EnrichedTool = {
        tool,
        manifest,
        enrichedDescription: this.createEnrichedDescription(tool, manifest),
      };

      enrichedTools.push(enrichedTool);
    }

    return enrichedTools;
  }

  /**
   * Get tools for a specific user with manifest enrichment
   * This wraps the existing getUserMcpTools function
   */
  async getToolsForUser(
    userId: string,
    getUserMcpToolsFn: (userId: string) => Promise<DynamicStructuredTool[]>,
  ): Promise<DynamicStructuredTool[]> {
    // Get original tools using existing function
    const tools = await getUserMcpToolsFn(userId);

    // Enrich with manifests
    const enrichedTools = await this.enrichToolsWithManifests(tools);

    // Return the original tools with enhanced descriptions
    return enrichedTools.map(({ tool, enrichedDescription }) => {
      if (enrichedDescription && enrichedDescription !== tool.description) {
        // Create a new tool instance with enhanced description
        // This preserves the original tool's functionality
        return new DynamicStructuredTool({
          name: tool.name,
          description: enrichedDescription,
          schema: tool.schema,
          func: tool.func,
        });
      }
      return tool;
    });
  }

  /**
   * Get tools by category
   */
  async getToolsByCategory(
    tools: DynamicStructuredTool[],
    category: string,
  ): Promise<DynamicStructuredTool[]> {
    const enrichedTools = await this.enrichToolsWithManifests(tools);

    return enrichedTools
      .filter(({ manifest }) => manifest?.category === category)
      .map(({ tool }) => tool);
  }

  /**
   * Get high-priority tools
   */
  async getHighPriorityTools(
    tools: DynamicStructuredTool[],
  ): Promise<DynamicStructuredTool[]> {
    const enrichedTools = await this.enrichToolsWithManifests(tools);

    return enrichedTools
      .filter(({ manifest }) => manifest?.priority === 'high')
      .map(({ tool }) => tool);
  }

  /**
   * Get tools that support batching
   */
  async getBatchableTools(
    tools: DynamicStructuredTool[],
  ): Promise<DynamicStructuredTool[]> {
    const enrichedTools = await this.enrichToolsWithManifests(tools);

    return enrichedTools
      .filter(({ manifest }) => manifest?.batchCompatible === true)
      .map(({ tool }) => tool);
  }

  /**
   * Create enriched description by combining tool and manifest descriptions
   */
  private createEnrichedDescription(
    tool: DynamicStructuredTool,
    manifest?: ToolManifest,
  ): string {
    if (!manifest) {
      return tool.description;
    }

    // Combine original description with manifest enhancements
    const parts = [tool.description];

    // Add category and priority hints
    if (manifest.category && manifest.priority) {
      parts.push(`[${manifest.category}] [Priority: ${manifest.priority}]`);
    }

    // Add enhanced description if different
    if (manifest.description && manifest.description !== tool.description) {
      parts.push(manifest.description);
    }

    // Add performance hints
    if (manifest.estimatedDuration) {
      parts.push(`Typical duration: ${manifest.estimatedDuration}ms`);
    }

    // Add tags for better discovery
    if (manifest.tags && manifest.tags.length > 0) {
      parts.push(`Tags: ${manifest.tags.join(', ')}`);
    }

    return parts.join(' | ');
  }

  /**
   * Get manifest for a specific tool
   */
  async getToolManifest(
    toolName: string,
    service?: string,
  ): Promise<ToolManifest | null> {
    if (service) {
      return this.manifestLoader.getManifest(service, toolName);
    }

    // Search all services
    const manifests = await this.manifestLoader.loadManifests();
    for (const svc of Object.keys(manifests)) {
      if (manifests[svc][toolName]) {
        return manifests[svc][toolName];
      }
    }

    return null;
  }

  /**
   * Validate that manifests are properly configured
   */
  async validateManifests(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const manifests = await this.manifestLoader.loadManifests();

      // Check if any manifests exist
      const totalManifests = Object.values(manifests).reduce(
        (sum, service) => sum + Object.keys(service).length,
        0,
      );

      if (totalManifests === 0) {
        warnings.push(
          'No tool manifests found. Tool enrichment will be limited.',
        );
      }

      // Validate manifest consistency
      for (const [service, serviceManifests] of Object.entries(manifests)) {
        for (const [toolId, manifest] of Object.entries(serviceManifests)) {
          if (manifest.id !== toolId) {
            errors.push(`Manifest ID mismatch: ${toolId} vs ${manifest.id}`);
          }
          if (manifest.service !== service) {
            errors.push(
              `Service mismatch for ${toolId}: ${service} vs ${manifest.service}`,
            );
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Failed to load manifests: ${error}`);
      return {
        valid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Get tools that support streaming
   */
  async getStreamingTools(): Promise<ToolManifest[]> {
    const manifests = await this.manifestLoader.loadManifests();
    const streamingTools: ToolManifest[] = [];

    for (const service of Object.values(manifests)) {
      for (const manifest of Object.values(service)) {
        if (manifest.streamingSupported) {
          streamingTools.push(manifest);
        }
      }
    }

    return streamingTools;
  }

  /**
   * Clear the manifest cache
   */
  clearCache(): void {
    this.manifestLoader.clearCache();
  }
}

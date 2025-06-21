/**
 * Tool Registry Service
 *
 * Extracted from SimpleLangGraphWrapper to handle tool registration
 * and schema validation with proper OpenAI compatibility.
 *
 * Features:
 * - Dynamic tool registration
 * - Schema validation without destructive patching
 * - OpenAI compatibility checking
 * - Tool metadata management
 */

import type { RequestLogger } from '../../services/observabilityService';

export interface ToolDefinition {
  name: string;
  description?: string;
  schema?: any;
  func?: (...args: any[]) => any;
  [key: string]: any;
}

export interface ToolRegistrationResult {
  success: boolean;
  tool?: ToolDefinition;
  error?: string;
  warnings?: string[];
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private fixedTools = new Set<string>();

  constructor(private logger: RequestLogger) {
    this.initializeFixedTools();
  }

  /**
   * Initialize the list of tools with proper OpenAI-compatible schemas
   */
  private initializeFixedTools(): void {
    const fixedToolsList = [
      // Document and knowledge base tools
      'listDocuments',
      'searchInternalKnowledgeBase',
      'searchAndRetrieveKnowledgeBase',
      'getMultipleDocuments',
      'getDocumentContents',
      'queryDocumentRows',
      'multiDocumentRetrieval',
      // Web search and extraction tools
      'tavilySearch',
      'tavilyExtract',
      'extractWebContent',
      // Utility and integration tools
      'requestSuggestions',
      'googleCalendar',
      'createBudget',
      'getMessagesFromOtherChat',
      // All Asana tools (now properly defined with correct schemas)
      'asana_list_workspaces',
      'asana_search_projects',
      'asana_search_tasks',
      'asana_get_task',
      'asana_create_task',
      'asana_get_task_stories',
      'asana_update_task',
      'asana_get_project',
      'asana_get_project_task_counts',
      'asana_get_project_sections',
      'asana_create_task_story',
      'asana_add_task_dependencies',
      'asana_add_task_dependents',
      'asana_delete_task',
      'asana_create_subtask',
      'asana_add_task_comment',
      'asana_get_task_comments',
      'asana_add_followers_to_task',
      'asana_get_multiple_tasks_by_gid',
      'asana_get_project_status',
      'asana_get_project_statuses',
      'asana_create_project_status',
      'asana_delete_project_status',
      'asana_set_parent_for_task',
      'asana_get_tasks_for_tag',
      'asana_get_tags_for_workspace',
      'asana_create_section_for_project',
      'asana_add_task_to_section',
      'asana_create_project',
      'asana_update_project',
      'asana_delete_project',
      'asana_get_teams_for_user',
      'asana_get_teams_for_workspace',
      'asana_list_workspace_users',
      'asana_get_user',
      'asana_get_current_user',
      'asana_upload_attachment',
      'asana_get_task_attachments',
      'asana_get_project_hierarchy',
      'asana_get_attachments_for_object',
      'asana_upload_attachment_for_object',
      'asana_download_attachment',
    ];

    for (const toolName of fixedToolsList) {
      this.fixedTools.add(toolName);
    }
  }

  /**
   * Register a tool with validation
   */
  register(tool: ToolDefinition): ToolRegistrationResult {
    if (!tool || !tool.name) {
      const error = 'Tool is missing name property';
      this.logger.warn('[Tool Registry] Registration failed:', { error });
      return { success: false, error };
    }

    try {
      // Validate the tool schema
      const validationResult = this.validateTool(tool);

      if (!validationResult.success) {
        return validationResult;
      }

      // Register the tool
      const processedTool = this.processTool(tool);
      this.tools.set(tool.name, processedTool);

      this.logger.info(`[Tool Registry] ✅ Registered tool: ${tool.name}`, {
        hasSchema: !!tool.schema,
        isFixed: this.fixedTools.has(tool.name),
      });

      return {
        success: true,
        tool: processedTool,
        warnings: validationResult.warnings,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[Tool Registry] Error registering tool ${tool.name}:`,
        error,
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: ToolDefinition[]): {
    successful: ToolDefinition[];
    failed: Array<{ tool: ToolDefinition; error: string }>;
    warnings: string[];
  } {
    const successful: ToolDefinition[] = [];
    const failed: Array<{ tool: ToolDefinition; error: string }> = [];
    const allWarnings: string[] = [];

    for (const tool of tools) {
      const result = this.register(tool);

      if (result.success && result.tool) {
        successful.push(result.tool);
        if (result.warnings) {
          allWarnings.push(...result.warnings);
        }
      } else {
        failed.push({ tool, error: result.error || 'Unknown error' });
      }
    }

    this.logger.info('[Tool Registry] Batch registration completed', {
      successful: successful.length,
      failed: failed.length,
      warnings: allWarnings.length,
    });

    return { successful, failed, warnings: allWarnings };
  }

  /**
   * Get a registered tool
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Validate a tool's schema and structure
   */
  private validateTool(tool: ToolDefinition): ToolRegistrationResult {
    const warnings: string[] = [];

    // Check for required properties
    if (!tool.name) {
      return { success: false, error: 'Tool name is required' };
    }

    // Check if tool is in fixed list (has proper schema)
    if (this.fixedTools.has(tool.name)) {
      this.logger.info(
        `[Tool Registry] ✅ Tool '${tool.name}' has proper OpenAI-compatible schema, using as-is`,
      );
      return { success: true, warnings };
    }

    // Warn about unknown tools
    this.logger.warn(
      `[Tool Registry] ⚠️ Tool '${tool.name}' not in fixed list, applying conservative validation`,
    );
    warnings.push(`Tool '${tool.name}' is not in the known-good tools list`);

    // Validate schema if present
    if (tool.schema) {
      const schemaValidation = this.validateSchema(tool.schema);
      if (!schemaValidation.isValid) {
        return {
          success: false,
          error: `Invalid schema: ${schemaValidation.error}`,
        };
      }
      if (schemaValidation.warnings) {
        warnings.push(...schemaValidation.warnings);
      }
    } else {
      warnings.push(`Tool '${tool.name}' has no schema defined`);
    }

    return { success: true, warnings };
  }

  /**
   * Process a tool for registration (apply any necessary transformations)
   */
  private processTool(tool: ToolDefinition): ToolDefinition {
    // If tool is in fixed list, return as-is
    if (this.fixedTools.has(tool.name)) {
      return tool;
    }

    // For unknown tools with schema issues, apply conservative fallback
    if (tool.schema && !this.isOpenAICompatible(tool.schema)) {
      try {
        const { z } = require('zod');
        const safeSchema = z.object({
          input: z
            .any()
            .describe(`Input parameters for ${tool.name}`)
            .default({}),
        });

        this.logger.warn(
          `[Tool Registry] Applied fallback schema for ${tool.name}`,
        );

        return {
          ...tool,
          schema: safeSchema,
        };
      } catch (error) {
        this.logger.error(
          `[Tool Registry] Error creating fallback schema for ${tool.name}:`,
          error,
        );
      }
    }

    return tool;
  }

  /**
   * Validate schema structure
   */
  private validateSchema(schema: any): {
    isValid: boolean;
    error?: string;
    warnings?: string[];
  } {
    try {
      // Basic schema validation
      if (typeof schema !== 'object' || schema === null) {
        return { isValid: false, error: 'Schema must be an object' };
      }

      // Check for Zod schema (has _def property)
      if (schema._def) {
        return { isValid: true };
      }

      // Check for JSON Schema structure
      if (schema.type || schema.properties) {
        return { isValid: true };
      }

      return {
        isValid: true,
        warnings: ['Schema structure is not recognized as Zod or JSON Schema'],
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Schema validation error: ${error}`,
      };
    }
  }

  /**
   * Check if schema is OpenAI compatible
   */
  private isOpenAICompatible(schema: any): boolean {
    try {
      // Basic checks for OpenAI function calling compatibility
      if (!schema) return false;

      // Zod schemas are generally compatible
      if (schema._def) return true;

      // JSON Schema with proper structure
      if (schema.type === 'object' && schema.properties) return true;

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Convert Zod schema to JSON Schema (utility method)
   */
  convertZodToJsonSchema(zodSchema: any): any {
    try {
      const { zodToJsonSchema } = require('zod-to-json-schema');
      const jsonSchema = zodToJsonSchema(zodSchema);

      this.logger.info(
        '[Tool Registry] Successfully converted Zod to JSON Schema',
      );
      return jsonSchema;
    } catch (error) {
      this.logger.warn(
        '[Tool Registry] Could not convert Zod to JSON Schema, using fallback',
        { error: error instanceof Error ? error.message : String(error) },
      );
      return {
        type: 'object',
        properties: {},
        additionalProperties: true,
      };
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    fixedTools: number;
    unknownTools: number;
    toolsByCategory: Record<string, number>;
  } {
    const totalTools = this.tools.size;
    const fixedToolsCount = Array.from(this.tools.keys()).filter((name) =>
      this.fixedTools.has(name),
    ).length;
    const unknownTools = totalTools - fixedToolsCount;

    // Categorize tools
    const toolsByCategory: Record<string, number> = {
      document: 0,
      search: 0,
      asana: 0,
      utility: 0,
      unknown: 0,
    };

    for (const toolName of this.tools.keys()) {
      if (toolName.startsWith('asana_')) {
        toolsByCategory.asana++;
      } else if (toolName.includes('Document') || toolName.includes('search')) {
        if (toolName.includes('search')) {
          toolsByCategory.search++;
        } else {
          toolsByCategory.document++;
        }
      } else if (
        ['requestSuggestions', 'googleCalendar', 'createBudget'].includes(
          toolName,
        )
      ) {
        toolsByCategory.utility++;
      } else {
        toolsByCategory.unknown++;
      }
    }

    return {
      totalTools,
      fixedTools: fixedToolsCount,
      unknownTools,
      toolsByCategory,
    };
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.logger.info('[Tool Registry] All tools cleared');
  }
}

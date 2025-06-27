import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// MCP Tool interface from the SDK
interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

/**
 * Handles all MCP tool schema patching, caching, and Zod conversion.
 * This service ensures that any tool schema is valid and optimized
 * before being used by other systems.
 */
class McpSchemaService {
  private schemaCache = new Map<string, any>();

  /**
   * Builds a valid Zod schema from an MCP tool's input schema.
   */
  public buildToolSchema(tool: McpTool, serverName: string): z.ZodSchema {
    console.log(
      `[McpSchemaService] Processing tool '${tool.name}' from ${serverName}`,
    );

    if (tool.inputSchema) {
      try {
        const { patchedSchema, patchCount, issues } = this.patchSchema(
          tool.inputSchema,
        );

        if (patchCount > 0) {
          console.warn(
            `[McpSchemaService] 🔧 Patched schema for tool '${tool.name}' from ${serverName}.`,
            {
              patches: patchCount,
              details: issues,
            },
          );
        } else {
          console.log(
            `[McpSchemaService] ✅ No patches needed for tool '${tool.name}' from ${serverName}`,
          );
        }

        return this.jsonSchemaToZod(patchedSchema);
      } catch (error) {
        console.error(
          `[McpSchemaService] Unrecoverable error converting schema for tool ${tool.name}, using fallback.`,
          error,
        );
      }
    } else {
      console.log(
        `[McpSchemaService] Tool '${tool.name}' from ${serverName} has no inputSchema, using fallback`,
      );
    }

    return z.object({
      input: z.any().optional().nullable().describe('Input parameters for the tool'),
    });
  }

  /**
   * Caching wrapper for the schema patcher.
   */
  public patchSchema(schema: any): {
    patchedSchema: any;
    patchCount: number;
    issues: string[];
  } {
    const schemaString = JSON.stringify(schema);
    if (this.schemaCache.has(schemaString)) {
      return this.schemaCache.get(schemaString);
    }
    const patchResult = this.performSchemaPatching(schema);
    this.schemaCache.set(schemaString, patchResult);
    return patchResult;
  }

  /**
   * Performs the actual schema patching and returns a detailed report.
   */
  private performSchemaPatching(schema: any): {
    patchedSchema: any;
    patchCount: number;
    issues: string[];
  } {
    console.log(
      `[McpSchemaService] Starting schema patching for schema:`,
      JSON.stringify(schema, null, 2),
    );

    if (typeof schema !== 'object' || schema === null) {
      console.log(
        `[McpSchemaService] Schema is not an object, skipping patches`,
      );
      return { patchedSchema: schema, patchCount: 0, issues: [] };
    }

    const newSchema = JSON.parse(JSON.stringify(schema));
    let patchCount = 0;
    const issues: string[] = [];

    const traverseAndPatch = (node: any, path: string) => {
      if (typeof node !== 'object' || node === null) return;

      console.log(`[McpSchemaService] Examining node at path '${path}':`, node);

      // Fix #1: Add missing 'items' for array types
      if (node.type === 'array' && typeof node.items === 'undefined') {
        console.log(
          `[McpSchemaService] 🔧 FOUND ISSUE: Missing 'items' for array at path '${path}'`,
        );
        node.items = {};
        patchCount++;
        issues.push(
          `Added missing 'items' property to array at path: '${path}'`,
        );
      }

      // Fix #2: Add missing 'type: object' if properties exist without a type
      if (!node.type && node.properties) {
        node.type = 'object';
        patchCount++;
        issues.push(
          `Added missing 'type: "object"' for node with properties at path: '${path}'`,
        );
      }

      // Fix #2b: Special handling for 'input' property that's missing type
      if ((path.endsWith('.input') || path === 'input') && !node.type) {
        // If input has properties, it should be an object
        if (node.properties) {
          node.type = 'object';
          patchCount++;
          issues.push(
            `Added missing 'type: "object"' for input parameter with properties at path: '${path}'`,
          );
        } else {
          // If input has no properties and no type, make it a generic object
          node.type = 'object';
          patchCount++;
          issues.push(
            `Added default 'type: "object"' for input parameter at path: '${path}'`,
          );
        }
      }

      // Fix #3: Ensure 'enum' values are always in an array
      if (node.enum && !Array.isArray(node.enum)) {
        node.enum = [node.enum];
        patchCount++;
        issues.push(`Converted non-array 'enum' to array at path: '${path}'`);
      }

      // Recurse into nested properties
      if (node.properties) {
        for (const key in node.properties) {
          traverseAndPatch(node.properties[key], path ? `${path}.${key}` : key);
        }
      }

      // Recurse into array item definitions
      if (node.items) {
        traverseAndPatch(node.items, `${path}.items`);
      }
    };

    traverseAndPatch(newSchema, 'root');
    return { patchedSchema: newSchema, patchCount, issues };
  }

  /**
   * Specialized patching for OpenAI function schemas to fix optional field compatibility.
   * OpenAI requires optional fields to also be nullable for structured outputs.
   */
  private performOpenAISchemaPatching(schema: any): {
    patchedSchema: any;
    patchCount: number;
    issues: string[];
  } {
    console.log(
      `[McpSchemaService] Starting OpenAI-specific schema patching for schema:`,
      JSON.stringify(schema, null, 2),
    );

    if (typeof schema !== 'object' || schema === null) {
      return { patchedSchema: schema, patchCount: 0, issues: [] };
    }

    const newSchema = JSON.parse(JSON.stringify(schema));
    let patchCount = 0;
    const issues: string[] = [];

    const traverseAndPatchForOpenAI = (node: any, path: string, requiredFields: Set<string> = new Set()) => {
      if (typeof node !== 'object' || node === null) return;

      // Track required fields at this level
      if (node.required && Array.isArray(node.required)) {
        node.required.forEach((field: string) => requiredFields.add(field));
      }

      // Process properties
      if (node.properties) {
        for (const [key, prop] of Object.entries(node.properties)) {
          const propPath = path ? `${path}.${key}` : key;
          const isRequired = requiredFields.has(key);
          
          // Fix #4: OpenAI compatibility - optional fields must be nullable
          if (!isRequired && typeof prop === 'object' && prop !== null) {
            // Check if this property needs to be made nullable
            const needsNullable = this.shouldMakeFieldNullable(prop as any, propPath);
            
            if (needsNullable) {
              // Add null to the type definition for OpenAI compatibility
              if ((prop as any).type && (prop as any).type !== 'null') {
                if (Array.isArray((prop as any).type)) {
                  if (!(prop as any).type.includes('null')) {
                    (prop as any).type.push('null');
                    patchCount++;
                    issues.push(`Added 'null' type to optional field '${propPath}' for OpenAI compatibility`);
                  }
                } else {
                  (prop as any).type = [(prop as any).type, 'null'];
                  patchCount++;
                  issues.push(`Converted type to array with null for optional field '${propPath}' for OpenAI compatibility`);
                }
              } else if (!(prop as any).type) {
                // If no type is specified, make it nullable any
                (prop as any).type = ['null'];
                patchCount++;
                issues.push(`Added null type to untyped optional field '${propPath}' for OpenAI compatibility`);
              }
            }
          }

          // Recurse into nested objects
          if (typeof prop === 'object' && prop !== null) {
            const nestedRequiredFields = new Set<string>();
            if ((prop as any).required && Array.isArray((prop as any).required)) {
              (prop as any).required.forEach((field: string) => nestedRequiredFields.add(field));
            }
            traverseAndPatchForOpenAI(prop, propPath, nestedRequiredFields);
          }
        }
      }

      // Recurse into array items
      if (node.items) {
        traverseAndPatchForOpenAI(node.items, `${path}.items`, new Set());
      }
    };

    traverseAndPatchForOpenAI(newSchema, 'root');
    return { patchedSchema: newSchema, patchCount, issues };
  }

  /**
   * Determines if a field should be made nullable for OpenAI compatibility
   */
  private shouldMakeFieldNullable(prop: any, path: string): boolean {
    // Skip if already has null type
    if (prop.type === 'null' || (Array.isArray(prop.type) && prop.type.includes('null'))) {
      return false;
    }

    // Skip if it's an object with properties (complex types)
    if (prop.type === 'object' && prop.properties) {
      return false;
    }

    // Skip if it's an array (arrays handle nullability differently)
    if (prop.type === 'array') {
      return false;
    }

    // Make primitive optional fields nullable
    if (prop.type === 'string' || prop.type === 'number' || prop.type === 'boolean') {
      return true;
    }

    // Make untyped optional fields nullable
    if (!prop.type) {
      return true;
    }

    return false;
  }

  /**
   * Simplified JSON Schema to Zod conversion.
   */
  private jsonSchemaToZod(schema: any): z.ZodSchema {
    if (schema.type === 'object' && schema.properties) {
      const shape: Record<string, z.ZodSchema> = {};

      for (const [key, prop] of Object.entries(schema.properties)) {
        const propSchema = prop as any;
        let zodType: z.ZodSchema;

        switch (propSchema.type) {
          case 'string':
            zodType = z.string();
            break;
          case 'number':
            zodType = z.number();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          case 'array':
            zodType = z.array(z.any());
            break;
          default:
            zodType = z.any();
        }

        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }

        if (!schema.required?.includes(key)) {
          zodType = zodType.optional().nullable();
        }

        shape[key] = zodType;
      }

      return z.object(shape);
    }

    return z.any();
  }

  /**
   * Clear the schema cache (useful for testing or memory management)
   */
  public clearCache(): void {
    this.schemaCache.clear();
    console.log('[McpSchemaService] Schema cache cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): { size: number } {
    return { size: this.schemaCache.size };
  }

  /**
   * Patches OpenAI function schemas directly before they're sent to the API.
   * This is the final step to ensure compatibility.
   */
  public patchOpenAIFunctionSchemas(tools: any[]): any[] {
    console.log(
      `[McpSchemaService] Patching ${tools.length} OpenAI function schemas`,
    );

    return tools.map((tool) => {
      if (tool.function?.parameters) {
        const originalSchema = tool.function.parameters;
        
        // Apply general schema patches first
        const { patchedSchema: generalPatchedSchema, patchCount: generalPatchCount, issues: generalIssues } =
          this.patchSchema(originalSchema);
        
        // Apply OpenAI-specific patches for optional field compatibility
        const { patchedSchema: openAIPatchedSchema, patchCount: openAIPatchCount, issues: openAIIssues } =
          this.performOpenAISchemaPatching(generalPatchedSchema);

        const totalPatchCount = generalPatchCount + openAIPatchCount;
        const allIssues = [...generalIssues, ...openAIIssues];

        if (totalPatchCount > 0) {
          console.warn(
            `[McpSchemaService] 🔧 Patched OpenAI function schema for '${tool.function.name}'`,
            {
              generalPatches: generalPatchCount,
              openAIPatches: openAIPatchCount,
              totalPatches: totalPatchCount,
              issues: allIssues,
              before: JSON.stringify(originalSchema, null, 2),
              after: JSON.stringify(openAIPatchedSchema, null, 2),
            },
          );

          return {
            ...tool,
            function: {
              ...tool.function,
              parameters: openAIPatchedSchema,
            },
          };
        }
      }

      return tool;
    });
  }
}

// Export a singleton instance
export const mcpSchemaService = new McpSchemaService();
export type { McpTool };

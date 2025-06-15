/**
 * ContextService
 *
 * Handles context processing, client configuration, conversation memory,
 * and cross-UI context sharing for the brain API.
 * Target: ~140 lines as per roadmap specifications.
 */

import type { BrainRequest } from '@/lib/validation/brainValidation';
import type { RequestLogger } from './observabilityService';
import type { ClientConfig } from '@/lib/db/queries';
import { retrieveConversationalMemory } from '@/lib/conversationalMemory';
import { processHistory } from '@/lib/contextUtils';
import type { ConversationalMemorySnippet } from '@/lib/contextUtils';
import type { BaseMessage } from '@langchain/core/messages';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from '@langchain/core/messages';

/**
 * Context processing configuration
 */
export interface ContextConfig {
  enableMemory?: boolean;
  maxMemoryDepth?: number;
  enableCrossUIContext?: boolean;
  enableContextValidation?: boolean;
}

/**
 * Processed context information
 */
export interface ProcessedContext {
  activeBitContextId?: string | null;
  currentActiveSpecialistId?: string | null;
  activeBitPersona?: string | null;
  selectedChatModel: string;
  userTimezone?: string;
  isFromGlobalPane?: boolean;
  referencedChatId?: string | null;
  clientConfig?: ClientConfig | null;
  memoryContext?: any[];
  conversationalMemory?: ConversationalMemorySnippet[];
  processedHistory?: BaseMessage[];
  fileContext?: {
    filename: string;
    contentType: string;
    url: string;
    extractedText?: string;
  } | null;
}

/**
 * Context validation result
 */
export interface ContextValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * ContextService class
 *
 * Provides centralized context processing capabilities for the brain API
 */
export class ContextService {
  private logger: RequestLogger;
  private config: ContextConfig;
  private clientConfig?: ClientConfig | null;

  constructor(
    logger: RequestLogger,
    clientConfig?: ClientConfig | null,
    config: ContextConfig = {},
  ) {
    this.logger = logger;
    this.clientConfig = clientConfig;
    this.config = {
      enableMemory: true,
      maxMemoryDepth: 10,
      enableCrossUIContext: true,
      enableContextValidation: true,
      ...config,
    };
  }

  /**
   * Process and enrich context from brain request
   */
  public async processContext(
    brainRequest: BrainRequest,
  ): Promise<ProcessedContext> {
    this.logger.info('Processing request context', {
      activeBitContextId: brainRequest.activeBitContextId,
      currentActiveSpecialistId: brainRequest.currentActiveSpecialistId,
      isFromGlobalPane: brainRequest.isFromGlobalPane,
      selectedChatModel: brainRequest.selectedChatModel,
      hasFileContext: !!brainRequest.fileContext,
      fileContextFilename: brainRequest.fileContext?.filename,
      chatId: brainRequest.chatId,
    });

    const processedContext: ProcessedContext = {
      activeBitContextId: brainRequest.activeBitContextId,
      currentActiveSpecialistId: brainRequest.currentActiveSpecialistId,
      activeBitPersona: brainRequest.activeBitPersona,
      selectedChatModel:
        brainRequest.selectedChatModel || this.getDefaultModel(),
      userTimezone: brainRequest.userTimezone,
      isFromGlobalPane: brainRequest.isFromGlobalPane,
      referencedChatId: brainRequest.referencedChatId,
      clientConfig: this.clientConfig,
      fileContext: brainRequest.fileContext,
    };

    let conversationalMemory: ConversationalMemorySnippet[] = [];

    // Add memory context if enabled
    if (this.config.enableMemory) {
      processedContext.memoryContext = this.extractMemoryContext(brainRequest);

      // Add conversational memory retrieval
      if (brainRequest.chatId && brainRequest.messages.length > 0) {
        const userInput = this.extractUserInput(brainRequest);
        conversationalMemory = await this.retrieveConversationalMemory(
          brainRequest.chatId,
          userInput,
        );
        processedContext.conversationalMemory = conversationalMemory;
      }
    }

    // MEMORY INTEGRATION: Process and store the full history with memory
    if (brainRequest.messages && brainRequest.messages.length > 0) {
      // Convert messages to LangChain format
      const rawMessages = brainRequest.messages.map((msg) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        } else {
          return new SystemMessage(msg.content);
        }
      });

      // Get current user input
      const currentUserInput = this.extractUserInput(brainRequest);

      // Process history with memory integration
      processedContext.processedHistory = processHistory(
        rawMessages,
        currentUserInput,
        conversationalMemory,
      );

      this.logger.info('Processed message history with memory integration', {
        originalMessageCount: rawMessages.length,
        processedHistoryCount: processedContext.processedHistory.length,
        memorySnippetCount: conversationalMemory.length,
      });
    }

    return processedContext;
  }

  /**
   * Validate context integrity and completeness
   */
  public validateContext(brainRequest: BrainRequest): ContextValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!brainRequest.selectedChatModel && !this.getDefaultModel()) {
      errors.push('No chat model specified and no default available');
    }

    // Validate specialist context consistency
    if (
      brainRequest.activeBitContextId &&
      !brainRequest.currentActiveSpecialistId
    ) {
      warnings.push(
        'Active bit context without specialist ID may lead to inconsistent behavior',
      );
    }

    // Validate global pane context
    if (brainRequest.isFromGlobalPane && !brainRequest.referencedChatId) {
      warnings.push('Global pane request without referenced chat ID');
    }

    // Validate timezone format
    if (
      brainRequest.userTimezone &&
      !this.isValidTimezone(brainRequest.userTimezone)
    ) {
      warnings.push('Invalid timezone format provided');
    }

    this.logger.info('Context validation completed', {
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract conversation memory context
   */
  private extractMemoryContext(brainRequest: BrainRequest): any[] {
    if (!this.config.enableMemory || !brainRequest.messages) {
      return [];
    }

    // Extract relevant context from recent messages
    const maxDepth = this.config.maxMemoryDepth || 10;
    const recentMessages = brainRequest.messages
      .slice(-maxDepth)
      .filter((msg) => msg.role === 'assistant' || msg.role === 'user');

    this.logger.info('Extracted memory context', {
      recentMessageCount: recentMessages.length,
      maxDepth: maxDepth,
    });

    return recentMessages;
  }

  /**
   * Extract user input from brain request
   */
  private extractUserInput(brainRequest: BrainRequest): string {
    if (!brainRequest.messages || brainRequest.messages.length === 0) {
      return '';
    }

    // Get the last user message
    const lastUserMessage = brainRequest.messages
      .filter((msg) => msg.role === 'user')
      .pop();

    return lastUserMessage?.content || '';
  }

  /**
   * Retrieve conversational memory for enhanced context
   */
  private async retrieveConversationalMemory(
    chatId: string,
    userQuery: string,
  ): Promise<ConversationalMemorySnippet[]> {
    try {
      this.logger.info('Retrieving conversational memory', {
        chatId: chatId.substring(0, 8),
        queryLength: userQuery.length,
      });

      const memorySnippets = await retrieveConversationalMemory(
        chatId,
        userQuery,
        3, // maxResults
      );

      this.logger.info('Retrieved conversational memory', {
        chatId: chatId.substring(0, 8),
        snippetCount: memorySnippets.length,
      });

      return memorySnippets;
    } catch (error) {
      this.logger.error('Error retrieving conversational memory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId: chatId.substring(0, 8),
      });
      return [];
    }
  }

  /**
   * Get default model based on client configuration
   */
  private getDefaultModel(): string {
    // ClientConfig doesn't have defaultModel property, use environment default
    return process.env.DEFAULT_MODEL_NAME || 'gpt-4.1';
  }

  /**
   * Validate timezone format
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create context-aware system prompt additions
   */
  public createContextPromptAdditions(context: ProcessedContext): string {
    const additions: string[] = [];

    if (context.userTimezone) {
      additions.push(`User timezone: ${context.userTimezone}`);
    }

    if (context.isFromGlobalPane) {
      additions.push('Request from global assistant pane');
    }

    if (context.activeBitPersona) {
      additions.push(`Active specialist persona: ${context.activeBitPersona}`);
    }

    if (context.referencedChatId && context.isFromGlobalPane) {
      additions.push(`Referenced main chat: ${context.referencedChatId}`);
    }

    // Add file context if available
    if (context.fileContext) {
      this.logger.info('Adding file context to prompt', {
        filename: context.fileContext.filename,
        contentType: context.fileContext.contentType,
        hasExtractedText: !!context.fileContext.extractedText,
        extractedTextLength: context.fileContext.extractedText?.length || 0,
      });

      const fileInfo = `File uploaded: ${context.fileContext.filename} (${context.fileContext.contentType})`;
      additions.push(fileInfo);
    }

    // Add conversational memory context
    let memoryContextSection = '';
    if (
      context.conversationalMemory &&
      context.conversationalMemory.length > 0
    ) {
      this.logger.info('Adding conversational memory to prompt', {
        memorySnippetCount: context.conversationalMemory.length,
      });

      const memorySnippets = context.conversationalMemory
        .map((snippet, index) => {
          let timestamp = 'Unknown';
          if (snippet.created_at) {
            try {
              if (snippet.created_at instanceof Date) {
                timestamp = snippet.created_at.toISOString();
              } else if (typeof snippet.created_at === 'string') {
                timestamp = new Date(snippet.created_at).toISOString();
              } else {
                // Handle DateTime objects or other formats
                timestamp = String(snippet.created_at);
              }
            } catch {
              timestamp = String(snippet.created_at);
            }
          }
          return `Memory ${index + 1} (${timestamp}): ${snippet.content}`;
        })
        .join('\n\n');

      memoryContextSection = `\n\n=== CONVERSATIONAL MEMORY ===
The following are relevant conversation excerpts from your past interactions with this user:

${memorySnippets}

Use this context to provide more personalized and contextually aware responses. Refer to previous discussions when relevant.
=== END MEMORY ===`;
    }

    // Handle file context separately for better formatting
    let fileContextSection = '';
    if (context.fileContext?.extractedText) {
      fileContextSection = `\n\n=== UPLOADED DOCUMENT ===
Filename: ${context.fileContext.filename}
Content Type: ${context.fileContext.contentType}

IMPORTANT: The user has uploaded a document. When they ask to "summarize this document" or similar requests, you should process the content below directly without using external tools.

DOCUMENT CONTENT:
${context.fileContext.extractedText}
=== END DOCUMENT ===`;
    }

    const contextSection =
      additions.length > 0 ? `\n\nContext: ${additions.join(', ')}` : '';
    return contextSection + memoryContextSection + fileContextSection;
  }
}

/**
 * Convenience functions for context operations
 */

/**
 * Create a ContextService instance with default configuration
 */
export function createContextService(
  logger: RequestLogger,
  clientConfig?: ClientConfig | null,
  config?: ContextConfig,
): ContextService {
  return new ContextService(logger, clientConfig, config);
}

/**
 * Quick context processing utility
 */
export async function processRequestContext(
  brainRequest: BrainRequest,
  logger: RequestLogger,
  clientConfig?: ClientConfig | null,
): Promise<ProcessedContext> {
  const service = createContextService(logger, clientConfig);
  return await service.processContext(brainRequest);
}

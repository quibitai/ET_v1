/**
 * MessageService
 *
 * Handles message formatting, conversion, and processing for the brain API.
 * Extracted from brain route and orchestrator to create clean separation of concerns.
 */

import type {
  BrainRequest,
  MessageData,
} from '@/lib/validation/brainValidation';
import type { RequestLogger } from './observabilityService';
import type { Attachment } from 'ai';
import { saveMessages, saveMessagesWithMemory } from '@/lib/db/queries';
import type { DBMessage } from '@/lib/db/schema';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { randomUUID } from 'node:crypto';

/**
 * Message formats for different systems
 */
export interface UIMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  attachments?: Attachment[];
  experimental_attachments?: Attachment[];
}

export interface LangChainMessage {
  type: 'human' | 'ai' | 'system';
  content: string;
}

export interface StreamingMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Message processing configuration
 */
export interface MessageProcessingConfig {
  sanitizeContent?: boolean;
  maxContentLength?: number;
  stripAttachments?: boolean;
  validateFormat?: boolean;
}

/**
 * Message processing result
 */
export interface MessageProcessingResult {
  success: boolean;
  messages?: any[];
  userInput?: string;
  errors?: string[];
  attachments?: Attachment[];
}

/**
 * MessageService class
 *
 * Provides centralized message processing capabilities for the brain API
 */
export class MessageService {
  private logger: RequestLogger;
  private config: MessageProcessingConfig;

  constructor(logger: RequestLogger, config: MessageProcessingConfig = {}) {
    this.logger = logger;
    this.config = {
      sanitizeContent: true,
      maxContentLength: 50000,
      stripAttachments: false,
      validateFormat: true,
      ...config,
    };
  }

  /**
   * Convert UI messages to LangChain format
   * Extracted from brainOrchestrator.prepareChatHistory()
   */
  public convertToLangChainFormat(
    messages: UIMessage[] | MessageData[],
  ): BaseMessage[] {
    this.logger.info('Converting messages to LangChain format', {
      messageCount: messages.length,
    });

    // Process ALL messages, not just history (this was causing empty arrays)
    const filteredMessages = this.filterContextBleedingPatterns(messages);

    return filteredMessages.map((message) => {
      const content = this.sanitizeContent(message.content);
      if (message.role === 'user') {
        return new HumanMessage({ content });
      } else if (message.role === 'assistant') {
        return new AIMessage({ content });
      } else {
        return new SystemMessage({ content });
      }
    });
  }

  /**
   * Filter out conversation patterns that cause context bleeding
   * Removes sequences where assistant couldn't fulfill a request to prevent
   * the agent from trying to answer old questions
   */
  private filterContextBleedingPatterns(
    messages: (UIMessage | MessageData)[],
  ): (UIMessage | MessageData)[] {
    const filtered: (UIMessage | MessageData)[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const nextMessage = messages[i + 1];

      // Check if this is a user message followed by an assistant "can't find" response
      if (
        message.role === 'user' &&
        nextMessage?.role === 'assistant' &&
        this.isUnsuccessfulResponse(nextMessage.content)
      ) {
        // Skip both the user question and the unsuccessful assistant response
        // to prevent the agent from trying to answer the old question
        this.logger.info(
          'Filtered out unsuccessful Q&A pair to prevent context bleeding',
          {
            userQuestion: message.content.substring(0, 50),
            assistantResponse: nextMessage.content.substring(0, 50),
          },
        );
        i++; // Skip the next message too
        continue;
      }

      // Only include successful exchanges and standalone messages
      filtered.push(message);
    }

    this.logger.info('Context bleeding filter applied', {
      originalCount: messages.length,
      filteredCount: filtered.length,
      removedCount: messages.length - filtered.length,
    });

    return filtered;
  }

  /**
   * Check if an assistant response indicates it couldn't fulfill the request
   */
  private isUnsuccessfulResponse(content: string): boolean {
    const lowerContent = content.toLowerCase();
    const unsuccessfulPatterns = [
      "i don't see",
      "i can't find",
      "i don't have access",
      "i'm unable to",
      "couldn't find",
    ];

    return unsuccessfulPatterns.some((pattern) =>
      lowerContent.includes(pattern),
    );
  }

  /**
   * Convert UI messages to streaming format
   * Used by modern pipeline
   */
  public convertToStreamingFormat(
    messages: UIMessage[] | MessageData[],
  ): StreamingMessage[] {
    this.logger.info('Converting messages to streaming format', {
      messageCount: messages.length,
    });

    return messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: this.sanitizeContent(msg.content),
    }));
  }

  /**
   * Extract user input from the last message
   * Extracted from brainOrchestrator.extractUserInput()
   */
  public extractUserInput(brainRequest: BrainRequest): string {
    const lastMessage = brainRequest.messages[brainRequest.messages.length - 1];
    const userInput = lastMessage?.content || '';

    this.logger.info('Extracted user input', {
      inputLength: userInput.length,
      hasInput: !!userInput.trim(),
    });

    return this.sanitizeContent(userInput);
  }

  /**
   * Process attachments from brain request
   */
  public processAttachments(brainRequest: BrainRequest): Attachment[] {
    const attachments: Attachment[] = [];

    // Extract attachments from messages
    brainRequest.messages.forEach((message) => {
      if (message.attachments) {
        attachments.push(...message.attachments);
      }
      if (message.experimental_attachments) {
        attachments.push(...message.experimental_attachments);
      }
    });

    this.logger.info('Processed attachments', {
      attachmentCount: attachments.length,
    });

    return attachments;
  }

  /**
   * Validate message format and content
   */
  public validateMessages(messages: UIMessage[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(messages)) {
      errors.push('Messages must be an array');
      return { valid: false, errors };
    }

    if (messages.length === 0) {
      errors.push('At least one message is required');
      return { valid: false, errors };
    }

    messages.forEach((message, index) => {
      if (
        !message.role ||
        !['user', 'assistant', 'system'].includes(message.role)
      ) {
        errors.push(`Message ${index}: Invalid role`);
      }

      if (!message.content || typeof message.content !== 'string') {
        errors.push(`Message ${index}: Content must be a non-empty string`);
      }

      if (
        this.config.maxContentLength &&
        message.content.length > this.config.maxContentLength
      ) {
        errors.push(`Message ${index}: Content exceeds maximum length`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Save assistant message to database with enhanced memory storage
   */
  public async saveAssistantMessage(
    content: string,
    chatId: string,
    clientId: string,
  ): Promise<void> {
    this.logger.info('Saving assistant message with memory storage', {
      contentLength: content.length,
      chatId: chatId.substring(0, 8),
      clientId,
    });

    try {
      const assistantMessage: DBMessage = {
        id: randomUUID(),
        chatId,
        role: 'assistant',
        parts: [{ type: 'text', text: content }],
        attachments: [],
        createdAt: new Date(),
        clientId,
      };

      // Use enhanced memory storage for better contextual awareness
      await saveMessagesWithMemory({
        messages: [assistantMessage],
        enableMemoryStorage: true,
      });

      this.logger.info('Assistant message saved successfully with memory', {
        messageId: assistantMessage.id,
        chatId,
      });
    } catch (error) {
      this.logger.error('Failed to save assistant message with memory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId,
      });
      throw error;
    }
  }

  /**
   * Save user message to database with enhanced memory storage
   */
  public async saveUserMessage(
    content: string,
    chatId: string,
    clientId: string,
  ): Promise<void> {
    this.logger.info('Saving user message with memory storage', {
      contentLength: content.length,
      chatId: chatId.substring(0, 8),
      clientId,
    });

    try {
      const userMessage: DBMessage = {
        id: randomUUID(),
        chatId,
        role: 'user',
        parts: [{ type: 'text', text: content }],
        attachments: [],
        createdAt: new Date(),
        clientId,
      };

      // Use enhanced memory storage for better contextual awareness
      await saveMessagesWithMemory({
        messages: [userMessage],
        enableMemoryStorage: true,
      });

      this.logger.info('User message saved successfully with memory', {
        messageId: userMessage.id,
        chatId,
      });
    } catch (error) {
      this.logger.error('Failed to save user message with memory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chatId,
      });
      throw error;
    }
  }

  /**
   * Sanitize message content
   */
  private sanitizeContent(content: string): string {
    if (!this.config.sanitizeContent) {
      return content;
    }

    // Basic sanitization
    return content
      .trim()
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n') // Handle old Mac line endings
      .substring(0, this.config.maxContentLength || 50000); // Enforce length limit
  }
}

/**
 * Convenience functions for common message operations
 */

/**
 * Create a MessageService instance with default configuration
 */
export function createMessageService(
  logger: RequestLogger,
  config?: MessageProcessingConfig,
): MessageService {
  return new MessageService(logger, config);
}

/**
 * Quick conversion utility for LangChain format
 */
export function convertMessagesToLangChain(
  messages: UIMessage[],
  logger: RequestLogger,
): BaseMessage[] {
  return new MessageService(logger).convertToLangChainFormat(messages);
}

/**
 * Quick conversion utility for streaming format
 */
export function convertMessagesToStreaming(
  messages: UIMessage[],
  logger: RequestLogger,
): StreamingMessage[] {
  const service = createMessageService(logger);
  return service.convertToStreamingFormat(messages);
}

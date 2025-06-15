/**
 * StreamingCoordinator - Prevents content duplication and manages streaming state
 *
 * This class ensures that content is only streamed once and provides standardized
 * progress indicators for different streaming events.
 */

export class StreamingCoordinator {
  private hasStreamedContent = {
    synthesis: false,
    conversational: false,
    simple: false,
  };

  /**
   * Mark that a specific node type has streamed content
   */
  markContentStreamed(
    nodeType: 'synthesis' | 'conversational' | 'simple',
  ): void {
    this.hasStreamedContent[nodeType] = true;
  }

  /**
   * Check if any node has already streamed content
   */
  hasAnyContentStreamed(): boolean {
    return Object.values(this.hasStreamedContent).some(Boolean);
  }

  /**
   * Check if a specific node type has streamed content
   */
  hasNodeStreamed(
    nodeType: 'synthesis' | 'conversational' | 'simple',
  ): boolean {
    return this.hasStreamedContent[nodeType];
  }

  /**
   * Determine if fallback streaming should occur
   */
  shouldStreamFallback(): boolean {
    return !this.hasAnyContentStreamed();
  }

  /**
   * Reset streaming state for new requests
   */
  reset(): void {
    this.hasStreamedContent = {
      synthesis: false,
      conversational: false,
      simple: false,
    };
  }

  /**
   * Get standardized progress indicators for different events
   */
  getProgressIndicator(eventType: string, nodeType?: string): string {
    const indicators: Record<string, Record<string, string>> = {
      on_chain_start: {
        simple_response: '📋 Formatting results...',
        synthesis: '📝 Generating analysis...',
        conversational_response: '💬 Preparing response...',
        default: '🔍 Processing...',
      },
      on_tool_start: {
        listDocuments: '📚 Searching knowledge base...',
        getDocumentContents: '📄 Retrieving document...',
        getMultipleDocuments: '📚 Retrieving documents...',
        tavilySearch: '🌐 Searching the web...',
        default: '🔧 Using tools...',
      },
      on_tool_end: {
        listDocuments: '✅ Found documents',
        getDocumentContents: '✅ Document retrieved',
        getMultipleDocuments: '✅ Documents retrieved',
        tavilySearch: '✅ Web search complete',
        default: '✅ Tool complete',
      },
    };

    const eventIndicators = indicators[eventType];
    if (!eventIndicators) return '';

    return (
      eventIndicators[nodeType || 'default'] || eventIndicators.default || ''
    );
  }

  /**
   * Get current streaming state for debugging
   */
  getState(): Record<string, boolean> {
    return { ...this.hasStreamedContent };
  }
}

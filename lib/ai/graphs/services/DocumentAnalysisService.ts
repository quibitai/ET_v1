/**
 * Document Analysis Service
 *
 * Handles complex document analysis scenarios including:
 * - Multi-document scenario detection
 * - Response strategy determination
 * - Document relevance assessment
 * - Citation and reference management
 */

import type { BaseMessage } from '@langchain/core/messages';
import type { RequestLogger } from '../../../services/observabilityService';
import type { GraphState } from '../state';
import { getToolMessages } from '../state';

/**
 * Document scenario analysis result
 */
export interface DocumentScenario {
  isMultiDocument: boolean;
  documentsFound: number;
  uniqueDocuments: string[];
  hasMinimumContext: boolean;
  recommendedResponseMode: 'synthesis' | 'simple' | 'conversational';
  requiresSpecialHandling: boolean;
  confidence: number;
}

/**
 * Response strategy recommendation
 */
export interface ResponseStrategy {
  type:
    | 'comparative_analysis'
    | 'analytical_report'
    | 'general_response'
    | 'conversational_answer';
  mode: 'synthesis' | 'simple' | 'conversational';
  reasoning: string;
  suggestedStructure?: string[];
  confidence: number;
}

/**
 * Document relevance assessment
 */
export interface DocumentRelevance {
  documentId: string;
  title: string;
  relevanceScore: number;
  relevanceReasons: string[];
  citationSuggestion: string;
}

/**
 * Service for analyzing document scenarios and determining response strategies
 */
export class DocumentAnalysisService {
  constructor(private logger: RequestLogger) {}

  /**
   * Analyze the document scenario based on tool results
   */
  analyzeDocumentScenario(state: GraphState): DocumentScenario {
    const toolMessages = getToolMessages(state);
    const documentData = this.extractDocumentData(toolMessages);

    const scenario: DocumentScenario = {
      isMultiDocument: documentData.uniqueDocuments.length > 1,
      documentsFound: documentData.totalDocuments,
      uniqueDocuments: documentData.uniqueDocuments,
      hasMinimumContext: documentData.hasSubstantialContent,
      recommendedResponseMode: this.determineResponseMode(documentData),
      requiresSpecialHandling: documentData.uniqueDocuments.length > 5,
      confidence: this.calculateScenarioConfidence(documentData),
    };

    this.logger.info('[DocumentAnalysis] Scenario analyzed', {
      isMultiDocument: scenario.isMultiDocument,
      documentsFound: scenario.documentsFound,
      recommendedMode: scenario.recommendedResponseMode,
      confidence: scenario.confidence,
    });

    return scenario;
  }

  /**
   * Determine the best response strategy based on query analysis
   */
  determineResponseStrategy(state: GraphState): ResponseStrategy {
    const userQuery = this.extractUserQuery(state);
    const queryLower = userQuery.toLowerCase();
    const documentScenario = this.analyzeDocumentScenario(state);

    // Comparative analysis indicators
    if (this.hasComparativeKeywords(queryLower)) {
      return {
        type: 'comparative_analysis',
        mode: 'synthesis',
        reasoning:
          'Query contains comparative keywords requiring structured analysis',
        suggestedStructure: [
          'Introduction',
          'Comparison Matrix',
          'Key Differences',
          'Recommendations',
        ],
        confidence: 0.85,
      };
    }

    // Analytical report indicators
    if (
      this.hasAnalyticalKeywords(queryLower) ||
      documentScenario.isMultiDocument
    ) {
      return {
        type: 'analytical_report',
        mode: 'synthesis',
        reasoning:
          'Query requires comprehensive analysis with multiple sources',
        suggestedStructure: [
          'Executive Summary',
          'Key Findings',
          'Detailed Analysis',
          'Conclusions',
        ],
        confidence: 0.8,
      };
    }

    // Conversational indicators
    if (this.hasConversationalKeywords(queryLower)) {
      return {
        type: 'conversational_answer',
        mode: 'conversational',
        reasoning:
          'Query indicates preference for interactive, engaging response',
        suggestedStructure: ['Direct Answer', 'Context', 'Follow-up Questions'],
        confidence: 0.75,
      };
    }

    // Default to general response
    return {
      type: 'general_response',
      mode: documentScenario.isMultiDocument ? 'synthesis' : 'simple',
      reasoning: 'Standard query requiring direct response',
      suggestedStructure: ['Answer', 'Supporting Information', 'Sources'],
      confidence: 0.7,
    };
  }

  /**
   * Assess document relevance and generate citation suggestions
   */
  assessDocumentRelevance(
    toolMessages: BaseMessage[],
    userQuery: string,
  ): DocumentRelevance[] {
    const documentData = this.extractDocumentData(toolMessages);
    const queryKeywords = this.extractKeywords(userQuery);

    return documentData.documents
      .map((doc) => {
        const relevanceScore = this.calculateRelevanceScore(doc, queryKeywords);
        const relevanceReasons = this.generateRelevanceReasons(
          doc,
          queryKeywords,
        );

        return {
          documentId: doc.id,
          title: doc.title,
          relevanceScore,
          relevanceReasons,
          citationSuggestion: this.generateCitationSuggestion(doc),
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Generate structured citations for documents
   */
  generateCitations(documentRelevance: DocumentRelevance[]): {
    inlineCitations: string[];
    referenceList: string[];
  } {
    const inlineCitations = documentRelevance.map((doc) => `[${doc.title}]`);

    const referenceList = documentRelevance.map(
      (doc) =>
        `**${doc.title}** - Relevance: ${(doc.relevanceScore * 100).toFixed(0)}% - ${doc.citationSuggestion}`,
    );

    return {
      inlineCitations,
      referenceList,
    };
  }

  /**
   * Extract and normalize document data from tool messages
   */
  private extractDocumentData(toolMessages: BaseMessage[]): {
    totalDocuments: number;
    uniqueDocuments: string[];
    documents: Array<{ id: string; title: string; content: string }>;
    hasSubstantialContent: boolean;
  } {
    const documents: Array<{ id: string; title: string; content: string }> = [];
    const uniqueDocuments = new Set<string>();

    toolMessages.forEach((message) => {
      try {
        const content =
          typeof message.content === 'string'
            ? JSON.parse(message.content)
            : message.content;

        // Handle different tool result formats
        if (content.document_id || content.title) {
          const docId = content.document_id || content.title;
          const docTitle = content.title || content.document_id || 'Untitled';
          const docContent =
            content.content || content.text || JSON.stringify(content);

          uniqueDocuments.add(docId);
          documents.push({
            id: docId,
            title: docTitle,
            content: docContent,
          });
        }

        // Handle multiple documents in single result
        if (content.documents && Array.isArray(content.documents)) {
          content.documents.forEach((doc: any) => {
            const docId = doc.id || doc.title || doc.document_id;
            if (docId) {
              uniqueDocuments.add(docId);
              documents.push({
                id: docId,
                title: doc.title || docId,
                content: doc.content || doc.text || JSON.stringify(doc),
              });
            }
          });
        }
      } catch (error) {
        // Log but don't fail for unparseable content
        this.logger.warn('[DocumentAnalysis] Failed to parse tool message', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    const totalContentLength = documents.reduce(
      (sum, doc) => sum + doc.content.length,
      0,
    );

    return {
      totalDocuments: documents.length,
      uniqueDocuments: Array.from(uniqueDocuments),
      documents,
      hasSubstantialContent: totalContentLength > 500, // Minimum content threshold
    };
  }

  /**
   * Extract user query from message history
   */
  private extractUserQuery(state: GraphState): string {
    const messages = state.messages || [];
    const humanMessage = messages.find((msg) => msg._getType?.() === 'human');
    return typeof humanMessage?.content === 'string'
      ? humanMessage.content
      : '';
  }

  /**
   * Determine appropriate response mode based on document data
   */
  private determineResponseMode(
    documentData: any,
  ): 'synthesis' | 'simple' | 'conversational' {
    if (documentData.uniqueDocuments.length > 3) {
      return 'synthesis';
    }

    if (documentData.uniqueDocuments.length > 1) {
      return 'synthesis';
    }

    if (documentData.hasSubstantialContent) {
      return 'simple';
    }

    return 'conversational';
  }

  /**
   * Calculate confidence in scenario analysis
   */
  private calculateScenarioConfidence(documentData: any): number {
    let confidence = 0.5; // base confidence

    if (documentData.uniqueDocuments.length > 0) confidence += 0.2;
    if (documentData.hasSubstantialContent) confidence += 0.2;
    if (documentData.totalDocuments === documentData.uniqueDocuments.length)
      confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Check for comparative keywords in query
   */
  private hasComparativeKeywords(query: string): boolean {
    const comparativeKeywords = [
      'compare',
      'comparison',
      'versus',
      'vs',
      'difference',
      'different',
      'similar',
      'similarity',
      'contrast',
      'better',
      'worse',
      'best',
      'pros and cons',
      'advantages',
      'disadvantages',
    ];

    return comparativeKeywords.some((keyword) => query.includes(keyword));
  }

  /**
   * Check for analytical keywords in query
   */
  private hasAnalyticalKeywords(query: string): boolean {
    const analyticalKeywords = [
      'analyze',
      'analysis',
      'research',
      'evaluate',
      'assessment',
      'investigate',
      'study',
      'examine',
      'review',
      'comprehensive',
      'detailed',
      'thorough',
      'deep dive',
      'report',
    ];

    return analyticalKeywords.some((keyword) => query.includes(keyword));
  }

  /**
   * Check for conversational keywords in query
   */
  private hasConversationalKeywords(query: string): boolean {
    const conversationalKeywords = [
      'tell me',
      'explain',
      'help me understand',
      'what do you think',
      'opinion',
      'recommend',
      'suggest',
      'advice',
      'chat',
      'discuss',
      'talk about',
      'your thoughts',
      'walk me through',
    ];

    return conversationalKeywords.some((keyword) => query.includes(keyword));
  }

  /**
   * Extract keywords from query for relevance calculation
   */
  private extractKeywords(query: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = query
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    // Remove common stop words
    const stopWords = new Set([
      'this',
      'that',
      'with',
      'have',
      'will',
      'from',
      'they',
      'know',
      'want',
      'been',
      'good',
      'much',
      'some',
      'time',
      'very',
      'when',
      'come',
      'here',
      'just',
      'like',
      'long',
      'make',
      'many',
      'over',
      'such',
      'take',
      'than',
      'them',
      'well',
      'were',
    ]);

    return words.filter((word) => !stopWords.has(word));
  }

  /**
   * Calculate relevance score for a document
   */
  private calculateRelevanceScore(doc: any, queryKeywords: string[]): number {
    if (queryKeywords.length === 0) return 0.5;

    const docText = `${doc.title} ${doc.content}`.toLowerCase();
    const matches = queryKeywords.filter((keyword) =>
      docText.includes(keyword),
    );

    return matches.length / queryKeywords.length;
  }

  /**
   * Generate relevance reasons for a document
   */
  private generateRelevanceReasons(
    doc: any,
    queryKeywords: string[],
  ): string[] {
    const reasons: string[] = [];
    const docText = `${doc.title} ${doc.content}`.toLowerCase();

    queryKeywords.forEach((keyword) => {
      if (docText.includes(keyword)) {
        if (doc.title.toLowerCase().includes(keyword)) {
          reasons.push(`Title contains "${keyword}"`);
        } else {
          reasons.push(`Content mentions "${keyword}"`);
        }
      }
    });

    if (reasons.length === 0) {
      reasons.push('General relevance to query topic');
    }

    return reasons;
  }

  /**
   * Generate citation suggestion for a document
   */
  private generateCitationSuggestion(doc: any): string {
    return `Document titled "${doc.title}" provides relevant information for this query`;
  }
}

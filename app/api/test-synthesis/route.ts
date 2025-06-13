/**
 * Test Synthesis Node Isolation
 *
 * This endpoint tests the synthesis node in isolation to verify it works
 * outside of the full LangGraph flow, helping debug streaming issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getRequestLogger } from '@/lib/services/observabilityService';

export async function POST(request: NextRequest) {
  const logger = getRequestLogger(request);

  try {
    logger.info('Starting synthesis node isolation test');

    // Get test data from request
    const { userQuery, toolResults } = await request.json();

    // Create LLM instance (same as in LangGraph)
    const llm = new ChatOpenAI({
      modelName: 'gpt-4.1-mini',
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });

    // Create synthesis messages (same as in synthesis node)
    const synthesisSystemMessage = new SystemMessage({
      content: `You are a research synthesis specialist. Create comprehensive research reports based on tool results.

CRITICAL RULES:
- Start immediately with the report title
- Do NOT include any conversational phrases, greetings, or "how can I assist" text
- Use ONLY the tool results provided to create the report
- Format with clear headings and professional structure
- Begin directly with: "# Research Report: [Title]"

Current date: ${new Date().toISOString()}`,
    });

    const synthesisInstruction = new HumanMessage({
      content: `User Query: ${userQuery}

Tool Results:
${toolResults}

Create a comprehensive research report based on these tool results. Start immediately with the report title and content:`,
    });

    const finalMessages = [synthesisSystemMessage, synthesisInstruction];

    logger.info('Testing synthesis with streaming approach', {
      messageCount: finalMessages.length,
      userQueryLength: userQuery?.length || 0,
      toolResultsLength: toolResults?.length || 0,
    });

    // Test streaming approach
    let fullResponse = '';
    const startTime = Date.now();

    try {
      const stream = await llm.stream(finalMessages);

      for await (const chunk of stream) {
        if (chunk.content && typeof chunk.content === 'string') {
          fullResponse += chunk.content;
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Synthesis streaming test completed successfully', {
        duration: `${duration}ms`,
        responseLength: fullResponse.length,
        responsePreview: fullResponse.substring(0, 200),
      });

      return NextResponse.json({
        success: true,
        method: 'streaming',
        duration,
        responseLength: fullResponse.length,
        response: fullResponse,
        preview: fullResponse.substring(0, 500),
      });
    } catch (streamError) {
      logger.error('Streaming test failed, trying invoke fallback', {
        error:
          streamError instanceof Error ? streamError.message : 'Unknown error',
      });

      // Fallback to invoke method
      const invokeStartTime = Date.now();
      const response = await llm.invoke(finalMessages);
      const invokeDuration = Date.now() - invokeStartTime;

      logger.info('Invoke fallback completed', {
        duration: `${invokeDuration}ms`,
        responseType: response._getType(),
        responseLength:
          typeof response.content === 'string' ? response.content.length : 0,
      });

      return NextResponse.json({
        success: true,
        method: 'invoke_fallback',
        streamError:
          streamError instanceof Error ? streamError.message : 'Unknown error',
        duration: invokeDuration,
        responseLength:
          typeof response.content === 'string' ? response.content.length : 0,
        response: response.content,
        preview:
          typeof response.content === 'string'
            ? response.content.substring(0, 500)
            : 'No content',
      });
    }
  } catch (error) {
    logger.error('Synthesis isolation test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Brain API Route - Day 10: Clean Hybrid Implementation
 *
 * Unified route handler using our complete service architecture:
 * - ValidationService for request validation
 * - ObservabilityService for logging and metrics
 * - BrainOrchestrator for hybrid routing (LangChain + Vercel AI SDK)
 * - ErrorService for structured error responses
 * Target: ~180 lines as per roadmap specifications.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getClientConfig } from '@/lib/db/queries';

// Import our hybrid service architecture
import {
  validateRequest,
  validateRequestSize,
  validateContentType,
} from '@/lib/services/validationService';
import { getRequestLogger } from '@/lib/services/observabilityService';
import { createBrainOrchestrator } from '@/lib/services/brainOrchestrator';

/**
 * Main POST handler - Clean hybrid implementation
 */
export async function POST(req: NextRequest) {
  const startTime = performance.now();

  // Initialize request logger
  const logger = getRequestLogger(req);

  try {
    logger.info('Brain API request received', {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent')?.substring(0, 100),
    });

    // Step 1: Validate request format and size
    const contentTypeResult = validateContentType(req);
    if (!contentTypeResult.success) {
      logger.warn('Invalid content type', { errors: contentTypeResult.errors });
      return NextResponse.json(
        {
          error: 'Invalid content type',
          message: 'Expected application/json',
          errors: contentTypeResult.errors,
        },
        { status: 400 },
      );
    }

    const sizeResult = validateRequestSize(req);
    if (!sizeResult.success) {
      logger.warn('Request size validation failed', {
        errors: sizeResult.errors,
      });
      return NextResponse.json(
        {
          error: 'Request too large',
          message: 'Request size exceeds maximum allowed',
          errors: sizeResult.errors,
        },
        { status: 413 },
      );
    }

    // Step 2: Validate request schema
    const validationResult = await validateRequest(req);
    if (!validationResult.success) {
      logger.warn('Request validation failed', {
        errors: validationResult.errors,
        errorCount: validationResult.errors?.length || 0,
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Request does not match expected schema',
          errors: validationResult.errors,
        },
        { status: 400 },
      );
    }

    // Type-safe access to validated data
    const brainRequest = validationResult.data;
    if (!brainRequest) {
      logger.error('Validation succeeded but no data returned');
      return NextResponse.json(
        {
          error: 'Internal error',
          message: 'Failed to process validated request',
        },
        { status: 500 },
      );
    }

    logger.info('Request validation successful', {
      messageCount: brainRequest.messages?.length || 0,
      selectedModel: brainRequest.selectedChatModel,
      contextId: brainRequest.activeBitContextId,
    });

    // Step 3: Get authentication and client configuration
    const session = await auth();
    if (!session?.user) {
      logger.warn('Unauthenticated request');
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to use the brain API',
        },
        { status: 401 },
      );
    }

    const clientConfig = session.user.clientId
      ? await getClientConfig(session.user.clientId)
      : null;

    logger.info('Client configuration loaded', {
      clientId: session.user.clientId,
      hasConfig: !!clientConfig,
      userId: session.user.id,
    });

    // Step 4: Initialize brain orchestrator with hybrid configuration including LangGraph
    const orchestrator = createBrainOrchestrator(logger, {
      enableHybridRouting: true,
      enableClassification: true,
      fallbackToLangChain: true,
      enableFallbackOnError: true,
      clientConfig,
      contextId: brainRequest.activeBitContextId,
      // Enable LangGraph for complex multi-step reasoning
      enableLangGraph: true,
      langGraphForComplexQueries: true,
    });

    logger.info('Brain orchestrator initialized with LangGraph support', {
      hybridRouting: true,
      classification: true,
      fallbackEnabled: true,
      langGraphEnabled: true,
      langGraphForComplex: true,
    });

    // Step 5: Process request through hybrid orchestrator
    const response = await orchestrator.processRequest(brainRequest);

    const processingTime = performance.now() - startTime;

    // Log completion
    logger.info('Brain request completed', {
      processingTime: `${processingTime.toFixed(2)}ms`,
      status: response.status,
      executionPath: response.headers.get('X-Execution-Path'),
    });

    // Add performance and correlation headers
    response.headers.set('X-Correlation-ID', logger.correlationId);
    response.headers.set('X-Processing-Time', `${processingTime.toFixed(2)}ms`);
    response.headers.set('X-Implementation', 'hybrid-v2.8.0');

    return response;
  } catch (error) {
    const processingTime = performance.now() - startTime;

    logger.error('Brain API processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime.toFixed(2)}ms`,
    });

    // Return structured error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message:
          error instanceof Error
            ? error.message
            : 'Brain API processing failed',
        correlationId: logger.correlationId,
        processingTime: `${processingTime.toFixed(2)}ms`,
      },
      { status: 500 },
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      implementation: 'hybrid-v2.8.0',
      timestamp: new Date().toISOString(),
      services: {
        validation: 'active',
        orchestration: 'active',
        langchain: 'active',
        vercelAI: 'active',
        observability: 'active',
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Implementation': 'hybrid-v2.8.0',
      },
    },
  );
}

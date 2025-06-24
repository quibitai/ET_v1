import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLangChainAgent, streamLangChainAgent } from '../langchainBridge';
import type { RequestLogger } from '../observabilityService';
import type { ModularLangGraphWrapper } from '@/lib/ai/graphs/ModularLangGraphWrapper';

// Mock dependencies
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn(() => ({
    modelName: 'gpt-4',
    temperature: 0.7,
  })),
}));

vi.mock('langchain/agents', () => ({
  AgentExecutor: vi.fn(() => ({
    invoke: vi.fn(),
    stream: vi.fn(),
  })),
  createOpenAIToolsAgent: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: vi.fn(() => ({})),
  },
  MessagesPlaceholder: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/executors/EnhancedAgentExecutor', () => ({
  EnhancedAgentExecutor: {
    fromExecutor: vi.fn(() => ({
      invoke: vi.fn(),
      stream: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/ai/tools/index', () => ({
  availableTools: [
    { name: 'mockTool1', description: 'Mock tool 1' },
    { name: 'mockTool2', description: 'Mock tool 2' },
  ],
}));

vi.mock('@/lib/ai/graphs', () => ({
  createModularLangGraphWrapper: vi.fn(() => ({
    getConfig: vi.fn(() => ({ llm: { modelName: 'gpt-4' }, currentDateTime: new Date().toISOString() })),
    stream: vi.fn(),
  })),
}));

vi.mock('@/lib/ai/prompts/specialists', () => ({
  specialistRegistry: {
    'test-specialist': {
      defaultTools: ['mockTool1'],
    },
  },
}));

vi.mock('@/lib/ai/models', () => ({
  modelMapping: {
    'test-context': 'gpt-4-turbo',
    default: 'gpt-4',
  },
}));

describe('LangChain Bridge Service', () => {
  let mockLogger: RequestLogger;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      correlationId: 'test-correlation-id',
      startTime: Date.now(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logTokenUsage: vi.fn(),
      logPerformanceMetrics: vi.fn(),
      finalize: vi.fn(),
    };

    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.DEFAULT_MODEL_NAME = 'gpt-4';
  });

  describe('createLangChainAgent', () => {
    it('should create agent with basic configuration', async () => {
      const config = {
        enableToolExecution: true,
        maxTools: 5,
      };

      const agent = await createLangChainAgent(
        'Test system prompt',
        config,
        mockLogger,
      );

      expect(agent).toBeDefined();
      expect(agent.langGraphWrapper).toBeDefined();
      expect(agent.tools).toBeDefined();
      expect(agent.llm).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating LangChain agent with config',
        expect.objectContaining({
          enableToolExecution: true,
        }),
      );
    });

    it('should use specialist tools when contextId provided', async () => {
      const config = {
        contextId: 'test-specialist',
        enableToolExecution: true,
      };

      const agent = await createLangChainAgent(
        'Test system prompt',
        config,
        mockLogger,
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating LangChain agent with config',
        expect.objectContaining({
          contextId: 'test-specialist',
        }),
      );
    });

    it('should use custom model when selectedChatModel provided', async () => {
      const config = {
        selectedChatModel: 'gpt-4-turbo',
        enableToolExecution: false,
      };

      await createLangChainAgent('Test system prompt', config, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating LangChain agent with config',
        expect.objectContaining({
          selectedChatModel: 'gpt-4-turbo',
        }),
      );
    });

    it('should limit tools when maxTools specified', async () => {
      const config = {
        maxTools: 1,
        enableToolExecution: true,
      };

      await createLangChainAgent('Test system prompt', config, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating LangChain agent with config',
        expect.objectContaining({
          maxTools: 1,
        }),
      );
    });

    it('should handle missing OPENAI_API_KEY', async () => {
      process.env.OPENAI_API_KEY = undefined;

      const config = {};

      await expect(
        createLangChainAgent('Test prompt', config, mockLogger),
      ).rejects.toThrow('Missing OPENAI_API_KEY environment variable');
    });
  });

  describe('streamLangChainAgent', () => {
    it('should execute streaming successfully', async () => {
      const mockAgent = {
        langGraphWrapper: {
          stream: vi
            .fn()
            .mockResolvedValue([{ output: 'chunk1' }, { output: 'chunk2' }]),
          getConfig: vi.fn(() => ({ systemPrompt: 'mock prompt' })),
        } as unknown as ModularLangGraphWrapper,
        tools: [],
        llm: {} as any,
        executionType: 'langgraph' as const,
      };

      const config = {
        contextId: 'test-context',
      };

      const chatHistory = [{ type: 'human', content: 'Hello' }];

      const stream = await streamLangChainAgent(
        mockAgent,
        'Test input',
        chatHistory,
        mockLogger,
      );

      expect(stream).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[LangGraph] LangGraph raw streaming path selected with execution plan',
        expect.objectContaining({
          input: 'Test input',
        }),
      );
    });

    it('should handle streaming errors', async () => {
      const mockAgent = {
        langGraphWrapper: {
          stream: vi.fn().mockRejectedValue(new Error('Stream error')),
          getConfig: vi.fn(() => ({ systemPrompt: 'mock prompt' })),
        } as unknown as ModularLangGraphWrapper,
        tools: [],
        llm: {} as any,
        executionType: 'langgraph' as const,
      };

      const config = {};

      await expect(
        streamLangChainAgent(mockAgent, 'Test input', [], mockLogger),
      ).rejects.toThrow('LangChain agent streaming failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'LangChain agent streaming failed',
        expect.objectContaining({
          error: 'Stream error',
        }),
      );
    });
  });
});

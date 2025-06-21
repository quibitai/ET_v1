import type { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { MultiMCPClient } from '@/lib/ai/mcp/MultiMCPClient';
import { ToolRegistry } from '@/lib/ai/tools/registry/ToolRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * MCP Performance Validation
 *
 * Tests performance characteristics and validates system efficiency:
 * - Initialization time
 * - Concurrent operations
 * - Memory usage
 * - Cache efficiency
 * - Streaming performance
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const body = await req.json();
    const iterations = Math.min(body.iterations || 10, 50); // Max 50 iterations
    const concurrency = Math.min(body.concurrency || 5, 10); // Max 10 concurrent

    const results: any = {
      timestamp: new Date().toISOString(),
      testConfig: { iterations, concurrency },
      performance: {},
      benchmarks: {},
      recommendations: [],
    };

    // Memory baseline
    const memoryBefore = process.memoryUsage();

    // Benchmark 1: Initialization Performance
    console.log('🏁 Starting initialization benchmark...');
    const initTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const client = new MultiMCPClient({ autoDiscovery: true });
      const initTime = Date.now() - start;
      initTimes.push(initTime);
      client.destroy(); // Cleanup

      // Small delay to prevent overwhelming
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    results.benchmarks.initialization = {
      iterations,
      times: initTimes,
      average: initTimes.reduce((a, b) => a + b, 0) / initTimes.length,
      min: Math.min(...initTimes),
      max: Math.max(...initTimes),
      median: initTimes.sort((a, b) => a - b)[Math.floor(initTimes.length / 2)],
    };

    // Benchmark 2: Tool Registry Performance
    console.log('📋 Starting tool registry benchmark...');
    const registryTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const registry = new ToolRegistry();
      await registry.getStreamingTools();
      await registry.validateManifests();
      const registryTime = Date.now() - start;
      registryTimes.push(registryTime);
      registry.clearCache();

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    results.benchmarks.toolRegistry = {
      iterations,
      times: registryTimes,
      average: registryTimes.reduce((a, b) => a + b, 0) / registryTimes.length,
      min: Math.min(...registryTimes),
      max: Math.max(...registryTimes),
    };

    // Benchmark 3: Concurrent Operations
    console.log('⚡ Starting concurrency benchmark...');
    const concurrentStart = Date.now();
    const concurrentPromises: Promise<any>[] = [];

    for (let i = 0; i < concurrency; i++) {
      const promise = (async () => {
        const client = new MultiMCPClient({ autoDiscovery: true });
        await client.checkAllServicesHealth();
        const tools = await client.getStreamingTools();
        client.destroy();
        return { tools: tools.length, duration: Date.now() - concurrentStart };
      })();
      concurrentPromises.push(promise);
    }

    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;

    results.benchmarks.concurrency = {
      concurrentOperations: concurrency,
      totalTime: concurrentTime,
      averageTimePerOperation: concurrentTime / concurrency,
      successfulOperations: concurrentResults.filter(
        (r) => r.status === 'fulfilled',
      ).length,
      failedOperations: concurrentResults.filter((r) => r.status === 'rejected')
        .length,
    };

    // Benchmark 4: Cache Performance
    console.log('💾 Starting cache performance test...');
    const client = new MultiMCPClient({ autoDiscovery: true });

    // Warm up cache
    await client.checkAllServicesHealth();
    await client.getStreamingTools();

    // Test cache hits
    const cacheTestStart = Date.now();
    for (let i = 0; i < 10; i++) {
      await client.getStreamingTools(); // Should hit cache
    }
    const cacheTestTime = Date.now() - cacheTestStart;

    const finalCacheStats = client.getCacheStats();

    results.benchmarks.cache = {
      cacheTestOperations: 10,
      totalTime: cacheTestTime,
      averageTimePerCachedOperation: cacheTestTime / 10,
      cacheStats: finalCacheStats,
    };

    // Memory after tests
    const memoryAfter = process.memoryUsage();

    results.performance.memory = {
      before: memoryBefore,
      after: memoryAfter,
      delta: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        external: memoryAfter.external - memoryBefore.external,
      },
      memoryEfficient:
        memoryAfter.heapUsed - memoryBefore.heapUsed < 50 * 1024 * 1024, // Less than 50MB
    };

    // Performance Analysis
    results.performance.analysis = {
      initializationGood: results.benchmarks.initialization.average < 1000, // Under 1 second
      registryGood: results.benchmarks.toolRegistry.average < 500, // Under 500ms
      concurrencyGood: results.benchmarks.concurrency.failedOperations === 0,
      cacheGood: Object.values(finalCacheStats).some(
        (stats: any) => stats.hitRate > 0.5,
      ),
      memoryGood: results.performance.memory.memoryEfficient,
    };

    // Recommendations
    if (!results.performance.analysis.initializationGood) {
      results.recommendations.push(
        'Consider lazy loading for service initialization',
      );
    }
    if (!results.performance.analysis.registryGood) {
      results.recommendations.push('Optimize manifest loading and caching');
    }
    if (!results.performance.analysis.concurrencyGood) {
      results.recommendations.push(
        'Review error handling in concurrent operations',
      );
    }
    if (!results.performance.analysis.cacheGood) {
      results.recommendations.push('Improve cache strategy and hit rates');
    }
    if (!results.performance.analysis.memoryGood) {
      results.recommendations.push('Review memory usage and potential leaks');
    }

    // Overall Performance Score
    const performanceScore = Object.values(results.performance.analysis)
      .filter((v) => typeof v === 'boolean')
      .reduce((score: number, good: any) => score + (good ? 1 : 0), 0);

    results.performance.overallScore = {
      score: performanceScore,
      maxScore: 5,
      percentage: Math.round((performanceScore / 5) * 100),
      grade:
        performanceScore >= 4
          ? 'A'
          : performanceScore >= 3
            ? 'B'
            : performanceScore >= 2
              ? 'C'
              : 'D',
    };

    // Cleanup
    client.destroy();

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ready',
      message: 'MCP Performance Validation Suite',
      usage: {
        post: 'Send { "iterations": 10, "concurrency": 5 } to run performance tests',
        defaultConfig: { iterations: 10, concurrency: 5 },
        maxLimits: { iterations: 50, concurrency: 10 },
      },
      benchmarks: [
        'Initialization Performance (multiple iterations)',
        'Tool Registry Performance (manifest loading)',
        'Concurrent Operations (parallel execution)',
        'Cache Performance (hit rates and efficiency)',
        'Memory Usage (delta and efficiency)',
      ],
      performanceTargets: {
        initialization: '< 1000ms average',
        toolRegistry: '< 500ms average',
        concurrency: '100% success rate',
        cache: '> 50% hit rate',
        memory: '< 50MB delta',
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

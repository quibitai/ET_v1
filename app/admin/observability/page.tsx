import { db } from '@/lib/db';
import { analyticsEvents, clients } from '@/lib/db/schema';
import { sql, desc, count, eq } from 'drizzle-orm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MetricsChart from './components/MetricsChart';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

/**
 * Observability Dashboard
 *
 * Displays key metrics and analytics for the AI system including:
 * - Query classification accuracy
 * - Execution path distribution
 * - Tool usage statistics
 * - Performance metrics
 */

interface AnalyticsData {
  queryRouting: {
    pathDistribution: Array<{ path: string; count: number }>;
    classificationDetails: Array<{
      shouldUseLangChain: boolean;
      confidence: number | null;
      count: number;
    }>;
    avgConfidence: number;
  };
  recentEvents: Array<{
    id: string;
    eventName: string;
    properties: any;
    createdAt: Date;
    clientId: string | null;
  }>;
  toolUsage: Array<{
    tool: string;
    count: number;
    successRate: number;
    hasReliableData: boolean;
  }>;
  performanceMetrics: {
    avgTotalTime: number;
    avgClassificationTime: number;
    totalRequests: number;
    errorRate: number;
  };
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  // Get query classification data - this drives execution paths
  const classificationRaw = await db
    .select({
      properties: analyticsEvents.properties,
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.eventName, 'QUERY_CLASSIFICATION'));

  // Process classification data manually for better control
  const classificationMap = new Map<
    string,
    { shouldUseLangChain: boolean; confidence: number | null; count: number }
  >();

  let totalConfidence = 0;
  let confidenceCount = 0;
  let langChainCount = 0;
  let vercelAICount = 0;

  classificationRaw.forEach((row) => {
    if (row.properties && typeof row.properties === 'object') {
      const props = row.properties as any;
      const shouldUseLangChain =
        props.shouldUseLangChain === true ||
        props.shouldUseLangChain === 'true';
      const confidence =
        props.confidence && !Number.isNaN(Number.parseFloat(props.confidence))
          ? Math.round(Number.parseFloat(props.confidence) * 100) / 100
          : null;

      // Count for path distribution
      if (shouldUseLangChain) {
        langChainCount++;
      } else {
        vercelAICount++;
      }

      // Track confidence
      if (confidence !== null) {
        totalConfidence += confidence;
        confidenceCount++;
      }

      const key = `${shouldUseLangChain}-${confidence}`;

      if (classificationMap.has(key)) {
        const existing = classificationMap.get(key);
        if (existing) {
          existing.count += 1;
        }
      } else {
        classificationMap.set(key, {
          shouldUseLangChain,
          confidence,
          count: 1,
        });
      }
    }
  });

  const classificationDetails = Array.from(classificationMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  // Create path distribution from classification results
  const pathDistribution = [
    { path: 'LangChain', count: langChainCount },
    { path: 'Vercel AI', count: vercelAICount },
  ].filter((item) => item.count > 0);

  const avgConfidence =
    confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  // Get recent events (last 50)
  const recentEvents = await db
    .select({
      id: analyticsEvents.id,
      eventName: analyticsEvents.eventName,
      properties: analyticsEvents.properties,
      createdAt: analyticsEvents.createdAt,
      clientId: analyticsEvents.clientId,
    })
    .from(analyticsEvents)
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(50);

  // Get tool usage from properties that contain tool information
  const toolUsageRaw = await db
    .select({
      properties: analyticsEvents.properties,
      createdAt: analyticsEvents.createdAt,
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.eventName, 'TOOL_USED'));

  // Process tool usage data - group by tool and time to avoid double counting
  const toolUsageMap = new Map<string, { count: number; successes: number }>();
  const processedEvents = new Set<string>(); // Track processed events to avoid duplicates

  toolUsageRaw.forEach((row) => {
    if (row.properties && typeof row.properties === 'object') {
      const properties = row.properties as any;
      const toolName =
        properties.toolName || properties.tool || properties.name;

      if (toolName && typeof toolName === 'string') {
        // Create a unique key for this event to avoid double processing
        const eventKey = `${toolName}-${row.createdAt.getTime()}-${JSON.stringify(properties).slice(0, 100)}`;

        if (processedEvents.has(eventKey)) {
          return; // Skip duplicate events
        }
        processedEvents.add(eventKey);

        // Clean up tool names
        const cleanName = toolName
          .replace(/Tool$/, '')
          .replace(/^tavily/, 'tavily')
          .replace(/Search$/, 'Search')
          .replace(/Extract$/, 'Extract');

        // For success tracking, be more lenient:
        // - If success is explicitly true, count as success
        // - If success is explicitly false, count as failure
        // - If success is missing/undefined, assume success (tools complete unless they fail)
        // - If there's an error property, count as failure regardless of success property
        const hasError =
          properties.error || properties.errorMessage || properties.exception;
        const explicitSuccess =
          properties.success === true || properties.success === 'true';
        const explicitFailure =
          properties.success === false || properties.success === 'false';

        let isSuccess = false;
        if (hasError) {
          isSuccess = false; // Has error = failure
        } else if (explicitSuccess) {
          isSuccess = true; // Explicitly marked as success
        } else if (explicitFailure) {
          isSuccess = false; // Explicitly marked as failure
        } else {
          // No explicit success/failure marking and no error = assume success
          // Most tools complete successfully without explicit success tracking
          isSuccess = true;
        }

        const existing = toolUsageMap.get(cleanName) || {
          count: 0,
          successes: 0,
        };

        toolUsageMap.set(cleanName, {
          count: existing.count + 1,
          successes: existing.successes + (isSuccess ? 1 : 0),
        });
      }
    }
  });

  const toolUsage = Array.from(toolUsageMap.entries())
    .map(([tool, data]) => ({
      tool,
      count: data.count,
      successRate:
        data.count > 0 ? Math.round((data.successes / data.count) * 100) : 0,
      hasReliableData: data.successes > 0 && data.count > data.successes, // Has both successes and failures
    }))
    .sort((a, b) => b.count - a.count);

  // Get performance metrics
  const performanceData = await db
    .select({
      totalTime: sql<number>`(properties->>'totalTime')::numeric`,
      classificationTime: sql<number>`(properties->>'classificationTime')::numeric`,
      success: sql<boolean>`(properties->>'success')::boolean`,
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.eventName, 'PERFORMANCE_METRIC'));

  const performanceMetrics = {
    avgTotalTime:
      performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + (p.totalTime || 0), 0) /
          performanceData.length
        : 0,
    avgClassificationTime:
      performanceData.length > 0
        ? performanceData.reduce(
            (sum, p) => sum + (p.classificationTime || 0),
            0,
          ) / performanceData.length
        : 0,
    totalRequests: performanceData.length,
    errorRate:
      performanceData.length > 0
        ? (performanceData.filter((p) => !p.success).length /
            performanceData.length) *
          100
        : 0,
  };

  return {
    queryRouting: {
      pathDistribution,
      classificationDetails,
      avgConfidence,
    },
    recentEvents,
    toolUsage,
    performanceMetrics,
  };
}

// Server action to seed test data
async function seedTestData() {
  'use server';

  try {
    // Seed some query classification events
    const classifications = [
      { shouldUseLangChain: true, confidence: 0.85 },
      { shouldUseLangChain: false, confidence: 0.92 },
      { shouldUseLangChain: true, confidence: 0.78 },
      { shouldUseLangChain: false, confidence: 0.88 },
      { shouldUseLangChain: true, confidence: 0.95 },
      { shouldUseLangChain: false, confidence: 0.73 },
    ];

    for (const classification of classifications) {
      await trackEvent({
        eventName: ANALYTICS_EVENTS.QUERY_CLASSIFICATION,
        properties: classification,
      });
    }

    // Seed some tool usage events with clear success/failure patterns
    const toolEvents = [
      { toolName: 'tavilySearch', success: true, duration: 1200 },
      { toolName: 'tavilySearch', success: true, duration: 950 },
      { toolName: 'tavilySearch', success: true, duration: 850 },
      { toolName: 'tavilySearch', success: false, error: 'API timeout' },
      { toolName: 'getWeather', success: true, duration: 450 },
      { toolName: 'getWeather', success: true, duration: 520 },
      { toolName: 'getWeather', success: true, duration: 480 },
      { toolName: 'searchInternalKnowledgeBase', success: true, duration: 800 },
      { toolName: 'searchInternalKnowledgeBase', success: true, duration: 750 },
      { toolName: 'tavilyExtract', success: true, duration: 1100 },
      { toolName: 'tavilyExtract', success: true, duration: 980 },
    ];

    for (const toolEvent of toolEvents) {
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: toolEvent,
      });
    }

    console.log('Test data seeded successfully!');
  } catch (error) {
    console.error('Error seeding test data:', error);
  }
}

export default async function ObservabilityPage() {
  const data = await getAnalyticsData();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Observability Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor AI system performance, usage patterns, and key metrics
          </p>
        </div>
        <form action={seedTestData}>
          <Button type="submit" variant="outline" size="sm">
            Seed Test Data
          </Button>
        </form>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.performanceMetrics.totalRequests}
            </div>
            <p className="text-xs text-muted-foreground">
              Tracked performance metrics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(data.performanceMetrics.avgTotalTime)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Including classification time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.performanceMetrics.errorRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Failed requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Classification Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(data.performanceMetrics.avgClassificationTime)}ms
            </div>
            <p className="text-xs text-muted-foreground">Query analysis time</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="routing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="routing">Query Routing</TabsTrigger>
          <TabsTrigger value="tools">Tool Usage</TabsTrigger>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
        </TabsList>

        <TabsContent value="routing" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Routing Distribution</CardTitle>
                <CardDescription>
                  How queries are routed between LangChain and Vercel AI based
                  on classification
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.queryRouting.pathDistribution.length > 0 ? (
                  <>
                    <MetricsChart
                      data={data.queryRouting.pathDistribution}
                      type="pie"
                      dataKey="count"
                      nameKey="path"
                    />
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Average Classification Confidence:{' '}
                        <span className="font-semibold text-foreground">
                          {(data.queryRouting.avgConfidence * 100).toFixed(1)}%
                        </span>
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="text-muted-foreground">
                      <svg
                        className="mx-auto h-12 w-12 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <h3 className="text-sm font-medium text-foreground">
                        No routing data yet
                      </h3>
                      <p className="text-sm mt-1">
                        Query routing analysis will appear here once queries are
                        processed.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Classification Details</CardTitle>
                <CardDescription>
                  Detailed breakdown of query classification results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.queryRouting.classificationDetails.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.queryRouting.classificationDetails.map(
                        (item, index) => (
                          <TableRow
                            key={`${item.shouldUseLangChain}-${item.confidence}-${index}`}
                          >
                            <TableCell>
                              <Badge
                                variant={
                                  item.shouldUseLangChain
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {item.shouldUseLangChain
                                  ? 'LangChain'
                                  : 'Vercel AI'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {typeof item.confidence === 'number'
                                ? `${(item.confidence * 100).toFixed(0)}%`
                                : 'N/A'}
                            </TableCell>
                            <TableCell>{item.count}</TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <p className="text-sm text-muted-foreground">
                      No classification data available yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tool Usage Frequency</CardTitle>
                <CardDescription>
                  How often each tool is used across the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.toolUsage.length > 0 ? (
                  <MetricsChart
                    data={data.toolUsage}
                    type="bar"
                    dataKey="count"
                    nameKey="tool"
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No tool usage data available yet. Tool tracking will appear
                    here once tools are used.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tool Performance</CardTitle>
                <CardDescription>
                  Success rates and reliability metrics for each tool
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.toolUsage.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tool</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Success Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.toolUsage.map((tool, index) => (
                        <TableRow key={`${tool.tool}-${index}`}>
                          <TableCell className="font-medium">
                            {tool.tool}
                          </TableCell>
                          <TableCell>{tool.count}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    tool.hasReliableData
                                      ? 'bg-green-500'
                                      : 'bg-yellow-500'
                                  }`}
                                  style={{ width: `${tool.successRate}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">
                                {tool.hasReliableData ? (
                                  `${tool.successRate}%`
                                ) : (
                                  <span className="text-muted-foreground">
                                    {tool.successRate}%*
                                  </span>
                                )}
                              </span>
                            </div>
                            {!tool.hasReliableData && (
                              <p className="text-xs text-muted-foreground mt-1">
                                *No explicit success tracking
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No tool performance data available yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Latest system events and analytics data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant="outline">{event.eventName}</Badge>
                      </TableCell>
                      <TableCell>{event.createdAt.toLocaleString()}</TableCell>
                      <TableCell>{event.clientId || 'N/A'}</TableCell>
                      <TableCell className="max-w-md">
                        {event.properties ? (
                          <div className="space-y-1">
                            {Object.entries(event.properties)
                              .slice(0, 3)
                              .map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="font-semibold text-muted-foreground">
                                    {key}:
                                  </span>{' '}
                                  <span className="break-all">
                                    {typeof value === 'object'
                                      ? `${JSON.stringify(value).substring(0, 50)}...`
                                      : String(value).length > 50
                                        ? `${String(value).substring(0, 50)}...`
                                        : String(value)}
                                  </span>
                                </div>
                              ))}
                            {Object.keys(event.properties).length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{Object.keys(event.properties).length - 3} more
                                properties
                              </div>
                            )}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

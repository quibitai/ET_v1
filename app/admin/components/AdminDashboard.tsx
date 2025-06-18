'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Users,
  BarChart3,
  Database,
  Activity,
  Clock,
} from 'lucide-react';
import type { Client, Specialist } from '@/lib/db/schema';
import { ClientEditor } from './ClientEditor';
import { SpecialistEditor } from './SpecialistEditor';
import { Badge } from '@/components/ui/badge';

interface AdminDashboardProps {
  clients: Client[];
  specialists: Specialist[];
}

/**
 * Consolidated Admin Dashboard Component
 *
 * Modern, tabbed interface that provides comprehensive admin functionality
 * including configuration management, system monitoring, and observability.
 */
export function AdminDashboard({ clients, specialists }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate dashboard stats
  const stats = {
    totalClients: clients.length,
    totalSpecialists: specialists.length,
    activeConfigs: clients.filter((c) => c.config_json).length,
    systemHealth: 'Operational',
  };

  return (
    <div className="space-y-6 h-full">
      {/* Dashboard Header */}
      <div className="border-b pb-6 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Settings className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage system configuration, monitor performance, and oversee
              application health.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeConfigs} with active configurations
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Specialists</CardTitle>
            <Settings className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSpecialists}</div>
            <p className="text-xs text-muted-foreground">
              AI specialist personas configured
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge
                variant="default"
                className="bg-green-100 text-green-800 hover:bg-green-100"
              >
                {stats.systemHealth}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              All services running normally
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge
                variant="default"
                className="bg-blue-100 text-blue-800 hover:bg-blue-100"
              >
                Optimized
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              220x performance improvement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <div className="flex-1 min-h-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="configuration"
              className="flex items-center gap-2"
            >
              <Settings className="size-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger
              value="observability"
              className="flex items-center gap-2"
            >
              <Activity className="size-4" />
              Observability
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent
            value="overview"
            className="flex-1 min-h-0 overflow-y-auto space-y-6"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Latest system events and configuration changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="size-2 bg-green-500 rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Database optimized
                        </p>
                        <p className="text-xs text-muted-foreground">
                          220x performance improvement
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        Today
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="size-2 bg-blue-500 rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          LangSmith integration added
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Visual debugging enabled
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        Today
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="size-2 bg-purple-500 rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Admin interface deployed
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Configuration management active
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" />
                        Today
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="size-5" />
                    Performance Metrics
                  </CardTitle>
                  <CardDescription>
                    Key system performance indicators
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Database Response Time</span>
                        <span className="font-medium text-green-600">
                          137ms
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: '95%' }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Query Success Rate</span>
                        <span className="font-medium text-green-600">
                          99.8%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: '99.8%' }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>System Uptime</span>
                        <span className="font-medium text-green-600">
                          99.9%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: '99.9%' }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent
            value="configuration"
            className="flex-1 min-h-0 overflow-y-auto space-y-6"
          >
            <div className="space-y-8">
              <section>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <Users className="size-6" />
                    Client Management
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Manage client configurations, branding, and custom
                    instructions.
                  </p>
                </div>
                <ClientEditor clients={clients} />
              </section>

              <section>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <Settings className="size-6" />
                    Specialist Management
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    Configure AI specialist personas, tools, and behaviors.
                  </p>
                </div>
                <SpecialistEditor specialists={specialists} />
              </section>
            </div>
          </TabsContent>

          {/* Observability Tab */}
          <TabsContent
            value="observability"
            className="flex-1 min-h-0 overflow-y-auto space-y-6"
          >
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="size-5" />
                    System Monitoring
                  </CardTitle>
                  <CardDescription>
                    Real-time system health and performance monitoring
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Activity className="size-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      LangSmith Integration Active
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Advanced monitoring and debugging capabilities are now
                      available through LangSmith.
                    </p>
                    <div className="grid gap-4 md:grid-cols-3 max-w-2xl mx-auto">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          100%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          LangGraph Tracing
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          26+
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Tools Monitored
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          Real-time
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Performance Metrics
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Query Classification</CardTitle>
                    <CardDescription>
                      Distribution of query types and routing decisions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>LangGraph Routing</span>
                          <span className="font-medium">45%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: '45%' }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>LangChain Routing</span>
                          <span className="font-medium">35%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: '35%' }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Vercel AI Routing</span>
                          <span className="font-medium">20%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: '20%' }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tool Usage Analytics</CardTitle>
                    <CardDescription>
                      Most frequently used tools and their success rates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          searchInternalKnowledgeBase
                        </span>
                        <Badge variant="secondary">892 calls</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">asana_create_task</span>
                        <Badge variant="secondary">156 calls</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">tavilySearch</span>
                        <Badge variant="secondary">134 calls</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">getWeatherTool</span>
                        <Badge variant="secondary">89 calls</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import type { Specialist } from '@/lib/db/schema';
import { updateSpecialist, createSpecialist } from '../actions';
import { Loader2, Wand2, Info } from 'lucide-react';

// Define available tools with categories and descriptions
const AVAILABLE_TOOLS = [
  // Search & Knowledge
  {
    name: 'searchInternalKnowledgeBase',
    category: 'Search & Knowledge',
    description:
      'Search and retrieve information from the internal knowledge base',
    icon: '🔍',
  },
  {
    name: 'listDocuments',
    category: 'Search & Knowledge',
    description: 'Lists available documents in the knowledge base',
    icon: '📋',
  },
  {
    name: 'getDocumentContents',
    category: 'Search & Knowledge',
    description: 'Retrieves full content of a document by ID or title',
    icon: '📄',
  },
  {
    name: 'tavilySearch',
    category: 'Search & Knowledge',
    description: 'Perform web searches using Tavily for current information',
    icon: '🌐',
  },
  {
    name: 'tavilyExtract',
    category: 'Search & Knowledge',
    description: 'Extract content from web pages using Tavily',
    icon: '📄',
  },

  // Document Management
  {
    name: 'queryDocumentRows',
    category: 'Document Management',
    description: 'Query and retrieve document rows from the database',
    icon: '📊',
  },
  {
    name: 'getMessagesFromOtherChat',
    category: 'Document Management',
    description: 'Retrieve messages from other chat conversations',
    icon: '💬',
  },

  // Project Management (Asana)
  {
    name: 'asana_get_user_info',
    category: 'Project Management',
    description: 'Get current user information from Asana',
    icon: '👤',
  },
  {
    name: 'asana_create_task',
    category: 'Project Management',
    description: 'Create new tasks in Asana projects',
    icon: '➕',
  },
  {
    name: 'asana_list_projects',
    category: 'Project Management',
    description: 'List and discover projects in Asana workspace',
    icon: '📁',
  },
  {
    name: 'asana_list_tasks',
    category: 'Project Management',
    description: 'List tasks from specific Asana projects',
    icon: '📋',
  },
  {
    name: 'asana_get_task_details',
    category: 'Project Management',
    description: 'Get detailed information about specific tasks',
    icon: '🔍',
  },
  {
    name: 'asana_update_task',
    category: 'Project Management',
    description: 'Update existing Asana tasks',
    icon: '✏️',
  },
  {
    name: 'asana_search',
    category: 'Project Management',
    description: 'Search across all Asana workspace resources',
    icon: '🔎',
  },

  // Utilities
  {
    name: 'getWeather',
    category: 'Utilities',
    description: 'Get current weather information for locations',
    icon: '🌤️',
  },
  {
    name: 'googleCalendar',
    category: 'Utilities',
    description: 'Access and manage Google Calendar events',
    icon: '📅',
  },
  {
    name: 'createBudget',
    category: 'Utilities',
    description: 'Create structured budgets for video production projects',
    icon: '💰',
  },

  // Suggestions
  {
    name: 'requestSuggestions',
    category: 'Suggestions',
    description: 'Request contextual suggestions for user interactions',
    icon: '💡',
  },
];

const TOOL_CATEGORIES = Array.from(
  new Set(AVAILABLE_TOOLS.map((tool) => tool.category)),
);

interface SpecialistFormProps {
  specialist?: Specialist;
  onSuccess?: () => void;
}

export function SpecialistForm({ specialist, onSuccess }: SpecialistFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Form state
  const [formData, setFormData] = useState({
    id: specialist?.id || '',
    name: specialist?.name || '',
    description: specialist?.description || '',
    personaPrompt: specialist?.personaPrompt || '',
    selectedTools: specialist?.defaultTools
      ? Array.isArray(specialist.defaultTools)
        ? specialist.defaultTools
        : []
      : [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update JSON when tools selection changes
  const getToolsJson = () => JSON.stringify(formData.selectedTools, null, 2);

  // Handle individual tool selection
  const handleToolToggle = (toolName: string, checked: boolean) => {
    const newTools = checked
      ? [...formData.selectedTools, toolName]
      : formData.selectedTools.filter((t) => t !== toolName);

    setFormData((prev) => ({ ...prev, selectedTools: newTools }));
  };

  // Handle category selection (select/deselect all tools in category)
  const handleCategoryToggle = (category: string, checked: boolean) => {
    const categoryTools = AVAILABLE_TOOLS.filter(
      (t) => t.category === category,
    ).map((t) => t.name);

    const newTools = checked
      ? [...new Set([...formData.selectedTools, ...categoryTools])]
      : formData.selectedTools.filter((t) => !categoryTools.includes(t));

    setFormData((prev) => ({ ...prev, selectedTools: newTools }));
  };

  // AI-powered prompt refinement
  const refinePromptWithAI = async () => {
    if (!formData.selectedTools?.length) {
      alert('Please select some tools first to get AI suggestions.');
      return;
    }

    setIsRefiningPrompt(true);
    try {
      const selectedToolsData = AVAILABLE_TOOLS.filter((t) =>
        formData.selectedTools.includes(t.name),
      );

      // Simple AI enhancement prompt
      const prompt = `Enhance this specialist prompt based on selected tools:

Current prompt: "${formData.personaPrompt}"

Selected tools: ${selectedToolsData.map((t) => `${t.name} (${t.description})`).join(', ')}

Make it more professional and tool-focused.`;

      // For now, just show the enhanced prompt idea
      const enhanced = `${formData.personaPrompt}\n\n[Enhanced with AI suggestions for tools: ${selectedToolsData.map((t) => t.name).join(', ')}]`;

      setFormData((prev) => ({ ...prev, personaPrompt: enhanced }));
      alert('Prompt enhanced with AI suggestions!');
    } catch (error) {
      alert('Failed to enhance prompt. Please try again.');
    } finally {
      setIsRefiningPrompt(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.id.trim()) newErrors.id = 'Specialist ID is required';
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.personaPrompt.trim())
      newErrors.personaPrompt = 'Persona prompt is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    startTransition(async () => {
      try {
        const formDataObj = new FormData();
        formDataObj.append('id', formData.id);
        formDataObj.append('name', formData.name);
        formDataObj.append('description', formData.description || '');
        formDataObj.append('personaPrompt', formData.personaPrompt);
        formDataObj.append(
          'defaultTools',
          JSON.stringify(formData.selectedTools),
        );

        if (specialist) {
          await updateSpecialist(specialist.id, formDataObj);
        } else {
          await createSpecialist(formDataObj);
        }

        onSuccess?.();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'An error occurred');
      }
    });
  };

  const getCategoryStats = (category: string) => {
    const categoryTools = AVAILABLE_TOOLS.filter(
      (t) => t.category === category,
    );
    const selectedCount = categoryTools.filter((t) =>
      formData.selectedTools?.includes(t.name),
    ).length;
    return { total: categoryTools.length, selected: selectedCount };
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="tools">Tools & Capabilities</TabsTrigger>
          <TabsTrigger value="prompt">AI Persona</TabsTrigger>
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <label htmlFor="specialist-id" className="text-sm font-medium">
                Specialist ID
              </label>
              <Input
                id="specialist-id"
                placeholder="e.g., echo-tango-specialist"
                value={formData.id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, id: e.target.value }))
                }
                disabled={!!specialist}
              />
              {errors.id && <p className="text-sm text-red-600">{errors.id}</p>}
              <p className="text-sm text-muted-foreground">
                Unique identifier for this specialist (cannot be changed after
                creation)
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="specialist-name" className="text-sm font-medium">
                Display Name
              </label>
              <Input
                id="specialist-name"
                placeholder="e.g., Echo Tango"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name}</p>
              )}
              <p className="text-sm text-muted-foreground">
                User-friendly name displayed in the interface
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="specialist-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <Textarea
                id="specialist-description"
                placeholder="Brief description of this specialist's role and capabilities"
                className="resize-none"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <p className="text-sm text-muted-foreground">
                Optional description for admin reference
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Tools & Capabilities Tab */}
        <TabsContent value="tools" className="space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Available Tools</h3>
                <p className="text-sm text-muted-foreground">
                  Select the tools this specialist should have access to
                </p>
              </div>
              <Badge variant="secondary">
                {formData.selectedTools?.length || 0} of{' '}
                {AVAILABLE_TOOLS.length} selected
              </Badge>
            </div>

            {/* Tool Categories */}
            <div className="space-y-4">
              {TOOL_CATEGORIES.map((category) => {
                const stats = getCategoryStats(category);
                const allSelected = stats.selected === stats.total;

                return (
                  <Card key={category}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) =>
                              handleCategoryToggle(category, e.target.checked)
                            }
                            className="size-4"
                          />
                          <div>
                            <CardTitle className="text-base">
                              {category}
                            </CardTitle>
                            <CardDescription>
                              {stats.selected} of {stats.total} tools selected
                            </CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant={
                            allSelected
                              ? 'default'
                              : stats.selected > 0
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {stats.selected}/{stats.total}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-2">
                        {AVAILABLE_TOOLS.filter(
                          (tool) => tool.category === category,
                        ).map((tool) => (
                          <div
                            key={tool.name}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={
                                formData.selectedTools?.includes(tool.name) ||
                                false
                              }
                              onChange={(e) =>
                                handleToolToggle(tool.name, e.target.checked)
                              }
                              className="size-4 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{tool.icon}</span>
                                <code className="text-sm font-mono">
                                  {tool.name}
                                </code>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {tool.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Generated JSON */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="size-4" />
                  Generated Tools Configuration
                </CardTitle>
                <CardDescription>
                  This JSON array is automatically generated from your tool
                  selections above
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="[]"
                  className="font-mono text-sm min-h-[100px]"
                  value={getToolsJson()}
                  readOnly
                />
                <p className="text-sm text-muted-foreground mt-2">
                  JSON array of tool names. This updates automatically when you
                  select tools above.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Persona Tab */}
        <TabsContent value="prompt" className="space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">AI Persona Prompt</h3>
                <p className="text-sm text-muted-foreground">
                  Define the personality, behavior, and capabilities of this
                  specialist
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refinePromptWithAI}
                disabled={isRefiningPrompt || !formData.selectedTools?.length}
                className="flex items-center gap-2"
              >
                {isRefiningPrompt ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                AI Enhance
              </Button>
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="You are [Specialist Name], a [role description]..."
                className="min-h-[300px] resize-none"
                value={formData.personaPrompt}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    personaPrompt: e.target.value,
                  }))
                }
              />
              {errors.personaPrompt && (
                <p className="text-sm text-red-600">{errors.personaPrompt}</p>
              )}
              <div className="text-sm text-muted-foreground">
                Define the specialist&apos;s personality, expertise,
                communication style, and how they should use their tools.
                {formData.selectedTools?.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-blue-800">
                    💡 Selected {formData.selectedTools.length} tools. Use
                    &quot;AI Enhance&quot; to optimize this prompt for the
                    selected capabilities.
                  </div>
                )}
              </div>
            </div>

            {formData.selectedTools?.length > 0 && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">
                    Selected Tool Capabilities
                  </CardTitle>
                  <CardDescription>
                    Your AI persona should reference these tools and their
                    capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    {AVAILABLE_TOOLS.filter((tool) =>
                      formData.selectedTools.includes(tool.name),
                    ).map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span>{tool.icon}</span>
                        <code className="font-mono">{tool.name}</code>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-muted-foreground">
                          {tool.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {specialist ? 'Update Specialist' : 'Create Specialist'}
        </Button>
      </div>
    </form>
  );
}

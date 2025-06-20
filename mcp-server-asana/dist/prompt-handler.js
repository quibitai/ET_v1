import { logger } from './utils/logger.js';
// Define available prompts
export const prompts = {
    'task-summary': {
        name: 'task-summary',
        description: 'Get a summary and status update for a task based on its notes, custom fields and comments',
        arguments: [
            {
                name: 'task_id',
                description: 'The task ID to get summary for',
                required: true,
            },
        ],
    },
    'project-status-report': {
        name: 'project-status-report',
        description: 'Generate a comprehensive project status report with task completion, team workload, and timeline analysis',
        arguments: [
            {
                name: 'project_id',
                description: 'The project ID to generate report for',
                required: true,
            },
        ],
    },
    'workflow-planning': {
        name: 'workflow-planning',
        description: 'Create a structured workflow plan for complex multi-step Asana operations',
        arguments: [
            {
                name: 'workflow_description',
                description: 'Description of the workflow or process to plan',
                required: true,
            },
            {
                name: 'workspace_id',
                description: 'The workspace ID to plan the workflow for',
                required: false,
            },
        ],
    },
    'team-productivity-analysis': {
        name: 'team-productivity-analysis',
        description: 'Analyze team productivity patterns and provide insights based on task completion and assignment data',
        arguments: [
            {
                name: 'team_id',
                description: 'The team ID to analyze',
                required: true,
            },
            {
                name: 'time_period',
                description: 'Time period for analysis (e.g., "last_week", "last_month", "last_quarter")',
                required: false,
            },
        ],
    },
};
export function createPromptHandler(client) {
    return {
        listPrompts: async () => {
            logger.info('Listing available prompts');
            return {
                prompts: Object.values(prompts),
            };
        },
        getPrompt: async (request) => {
            const { name, arguments: args = {} } = request.params;
            logger.info(`Getting prompt: ${name}`, { args });
            try {
                switch (name) {
                    case 'task-summary':
                        return await generateTaskSummaryPrompt(client, args);
                    case 'project-status-report':
                        return await generateProjectStatusReportPrompt(client, args);
                    case 'workflow-planning':
                        return await generateWorkflowPlanningPrompt(client, args);
                    case 'team-productivity-analysis':
                        return await generateTeamProductivityAnalysisPrompt(client, args);
                    default:
                        throw new Error(`Unknown prompt: ${name}`);
                }
            }
            catch (error) {
                logger.error(`Prompt generation failed for ${name}:`, error);
                throw new Error(`Prompt generation failed: ${error.message}`);
            }
        },
    };
}
async function generateTaskSummaryPrompt(client, args) {
    const { task_id } = args;
    if (!task_id) {
        throw new Error('task_id is required for task-summary prompt');
    }
    try {
        // Fetch task details with comprehensive fields
        const task = await client.getTask(task_id, 'name,notes,completed,assignee,assignee.name,due_on,created_at,modified_at,custom_fields,custom_fields.name,custom_fields.display_value,projects,projects.name,tags,tags.name,parent,parent.name,subtasks,subtasks.name,subtasks.completed');
        // Fetch task stories/comments
        const stories = await client.getTaskStories(task_id, 'text,created_at,created_by,created_by.name,type');
        const prompt = `
# Task Summary Analysis

Please analyze the following Asana task and provide a comprehensive summary and status update:

## Task Details
- **Name**: ${task.name}
- **Status**: ${task.completed ? 'Completed' : 'In Progress'}
- **Assignee**: ${task.assignee?.name || 'Unassigned'}
- **Due Date**: ${task.due_on || 'No due date set'}
- **Created**: ${new Date(task.created_at).toLocaleDateString()}
- **Last Modified**: ${new Date(task.modified_at).toLocaleDateString()}
- **Project(s)**: ${task.projects?.map((p) => p.name).join(', ') || 'No projects'}
- **Tags**: ${task.tags?.map((t) => t.name).join(', ') || 'No tags'}

## Task Description
${task.notes || 'No description provided'}

## Custom Fields
${task.custom_fields?.length > 0
            ? task.custom_fields
                .map((cf) => `- **${cf.name}**: ${cf.display_value || 'Not set'}`)
                .join('\n')
            : 'No custom fields'}

## Subtasks
${task.subtasks?.length > 0
            ? task.subtasks
                .map((st) => `- [${st.completed ? 'x' : ' '}] ${st.name}`)
                .join('\n')
            : 'No subtasks'}

## Recent Activity & Comments
${stories?.length > 0
            ? stories
                .slice(0, 10)
                .map((story) => `**${new Date(story.created_at).toLocaleDateString()}** - ${story.created_by?.name || 'System'}: ${story.text || story.type}`)
                .join('\n\n')
            : 'No recent activity'}

## Analysis Instructions

Based on the above information, please provide:

1. **Current Status Assessment**
   - Overall progress evaluation
   - Key accomplishments and milestones reached
   - Current blockers or challenges (if any)

2. **Timeline Analysis**
   - Progress against due date (if set)
   - Estimated completion time based on current pace
   - Recommendations for timeline adjustments

3. **Quality & Completeness Review**
   - Completeness of task description and requirements
   - Quality of deliverables based on comments/updates
   - Suggestions for improvement

4. **Next Steps Recommendations**
   - Immediate action items
   - Dependencies that need attention
   - Resource allocation suggestions

5. **Risk Assessment**
   - Potential risks to completion
   - Mitigation strategies
   - Escalation recommendations if needed

Please format your response in a clear, executive-summary style that would be useful for project managers and stakeholders.
    `;
        return {
            prompt: {
                name: 'task-summary',
                description: 'Task summary and analysis prompt',
                content: prompt.trim(),
            },
        };
    }
    catch (error) {
        throw new Error(`Failed to generate task summary prompt: ${error.message}`);
    }
}
async function generateProjectStatusReportPrompt(client, args) {
    const { project_id } = args;
    if (!project_id) {
        throw new Error('project_id is required for project-status-report prompt');
    }
    try {
        // Fetch project hierarchy with comprehensive data
        const hierarchy = await client.getProjectHierarchy(project_id, {
            include_completed_tasks: true,
            include_subtasks: true,
            opt_fields_project: 'name,created_at,due_on,notes,owner,owner.name,team,team.name,archived',
            opt_fields_tasks: 'name,completed,assignee,assignee.name,due_on,created_at,modified_at',
            opt_fields_sections: 'name,created_at',
        });
        // Fetch recent project statuses
        const statuses = await client.getProjectStatuses(project_id, {
            limit: 5,
            opt_fields: 'text,color,created_at,created_by,created_by.name',
        });
        const project = hierarchy.project;
        const stats = hierarchy.statistics;
        const prompt = `
# Project Status Report

Please generate a comprehensive project status report based on the following data:

## Project Overview
- **Name**: ${project.name}
- **Owner**: ${project.owner?.name || 'No owner assigned'}
- **Team**: ${project.team?.name || 'No team assigned'}
- **Created**: ${new Date(project.created_at).toLocaleDateString()}
- **Due Date**: ${project.due_on ? new Date(project.due_on).toLocaleDateString() : 'No due date set'}
- **Status**: ${project.archived ? 'Archived' : 'Active'}

## Project Description
${project.notes || 'No project description provided'}

## Task Statistics
- **Total Tasks**: ${stats.total_tasks}
- **Completed Tasks**: ${stats.completed_tasks}
- **Completion Rate**: ${stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0}%
- **Total Subtasks**: ${stats.total_subtasks}
- **Completed Subtasks**: ${stats.completed_subtasks}
- **Subtask Completion Rate**: ${stats.total_subtasks > 0 ? Math.round((stats.completed_subtasks / stats.total_subtasks) * 100) : 0}%

## Project Structure
${hierarchy.sections
            .map((section) => `
### ${section.name} (${section.tasks.length} tasks)
${section.tasks
            .map((task) => `- [${task.completed ? 'x' : ' '}] ${task.name} ${task.assignee?.name ? `(${task.assignee.name})` : '(Unassigned)'} ${task.due_on ? `- Due: ${task.due_on}` : ''}`)
            .join('\n')}
`)
            .join('\n')}

## Recent Status Updates
${statuses?.length > 0
            ? statuses
                .map((status) => `**${new Date(status.created_at).toLocaleDateString()}** (${status.color || 'neutral'}) - ${status.created_by?.name || 'Unknown'}: ${status.text}`)
                .join('\n\n')
            : 'No recent status updates'}

## Analysis Instructions

Please provide a comprehensive project status report that includes:

1. **Executive Summary**
   - Overall project health and progress
   - Key achievements and milestones
   - Major concerns or blockers

2. **Progress Analysis**
   - Completion rate analysis by section
   - Timeline adherence assessment
   - Velocity and productivity trends

3. **Resource Allocation Review**
   - Team workload distribution
   - Unassigned tasks requiring attention
   - Resource bottlenecks or gaps

4. **Risk Assessment**
   - Tasks at risk of missing deadlines
   - Dependencies and blockers
   - Quality concerns

5. **Recommendations**
   - Immediate action items
   - Resource reallocation suggestions
   - Timeline adjustments needed
   - Process improvements

6. **Next Period Forecast**
   - Expected completion dates
   - Upcoming milestones
   - Resource requirements

Format the report in a professional, stakeholder-ready format with clear sections and actionable insights.
    `;
        return {
            prompt: {
                name: 'project-status-report',
                description: 'Comprehensive project status report prompt',
                content: prompt.trim(),
            },
        };
    }
    catch (error) {
        throw new Error(`Failed to generate project status report prompt: ${error.message}`);
    }
}
async function generateWorkflowPlanningPrompt(client, args) {
    const { workflow_description, workspace_id } = args;
    if (!workflow_description) {
        throw new Error('workflow_description is required for workflow-planning prompt');
    }
    try {
        // Fetch workspace context if provided
        let workspaceInfo = '';
        if (workspace_id) {
            const teams = await client.getTeamsForWorkspace(workspace_id, 'name,description');
            const users = await client.listWorkspaceUsers(workspace_id, {
                opt_fields: 'name,email',
            });
            workspaceInfo = `
## Workspace Context
- **Teams Available**: ${teams.map((t) => t.name).join(', ')}
- **Team Members**: ${users
                .slice(0, 20)
                .map((u) => u.name)
                .join(', ')}${users.length > 20 ? ` and ${users.length - 20} more...` : ''}
      `;
        }
        const prompt = `
# Workflow Planning Assistant

Please create a detailed, step-by-step workflow plan for the following request:

## Workflow Description
${workflow_description}

${workspaceInfo}

## Planning Instructions

Based on the workflow description above, please provide:

1. **Workflow Analysis**
   - Break down the request into logical components
   - Identify the main objectives and deliverables
   - Determine complexity level (Simple/Moderate/Complex)

2. **Step-by-Step Execution Plan**
   - List each step in chronological order
   - Identify which Asana tools/operations are needed for each step
   - Specify dependencies between steps
   - Estimate time requirements for each step

3. **Resource Requirements**
   - Team members or roles needed
   - Projects or workspaces to be involved
   - Custom fields or templates required
   - External dependencies or approvals

4. **Risk Assessment & Mitigation**
   - Potential failure points
   - Contingency plans
   - Quality checkpoints
   - Rollback procedures if needed

5. **Success Criteria**
   - Measurable outcomes
   - Quality standards
   - Completion indicators
   - Validation steps

6. **Implementation Recommendations**
   - Optimal execution sequence
   - Parallel vs sequential operations
   - Batch processing opportunities
   - Monitoring and progress tracking

## Available Asana Tools Reference
For your planning, you can utilize these Asana operations:
- **Workspace Management**: List workspaces, get teams, list users
- **Project Operations**: Search, create, get details, manage sections
- **Task Management**: Search, create, update, delete, manage dependencies
- **Team Coordination**: Assign tasks, add followers, manage comments
- **Status Tracking**: Create status updates, manage project hierarchy
- **Bulk Operations**: Multiple task operations, batch updates

Please format your response as a clear, actionable workflow plan that could be executed either manually or through automation.
    `;
        return {
            prompt: {
                name: 'workflow-planning',
                description: 'Structured workflow planning prompt',
                content: prompt.trim(),
            },
        };
    }
    catch (error) {
        throw new Error(`Failed to generate workflow planning prompt: ${error.message}`);
    }
}
async function generateTeamProductivityAnalysisPrompt(client, args) {
    const { team_id, time_period = 'last_month' } = args;
    if (!team_id) {
        throw new Error('team_id is required for team-productivity-analysis prompt');
    }
    try {
        // Fetch team members
        const users = await client.listWorkspaceUsers(undefined, {
            opt_fields: 'name,email',
            limit: 100,
        });
        // Note: In a real implementation, we would filter tasks by team and time period
        // For now, we'll provide a template that can be filled with actual data
        const prompt = `
# Team Productivity Analysis

Please analyze team productivity patterns and provide insights for the following team:

## Team Information
- **Team ID**: ${team_id}
- **Analysis Period**: ${time_period}
- **Team Members**: ${users
            .slice(0, 10)
            .map((u) => u.name)
            .join(', ')}${users.length > 10 ? ` and ${users.length - 10} more...` : ''}

## Analysis Framework

To complete this analysis, please gather and analyze the following data points:

### 1. Task Completion Metrics
- Tasks completed per team member during the period
- Average time to completion for different task types
- Completion rate trends over time
- Quality metrics (rework, comments, revisions)

### 2. Workload Distribution
- Task assignment patterns across team members
- Workload balance analysis
- Identification of over/under-utilized resources
- Skill-based task allocation effectiveness

### 3. Collaboration Patterns
- Cross-team project participation
- Comment and feedback frequency
- Task handoff efficiency
- Communication quality indicators

### 4. Timeline Performance
- On-time delivery rates
- Deadline adherence patterns
- Estimation accuracy
- Timeline adjustment frequency

### 5. Process Efficiency
- Task creation to completion cycles
- Bottleneck identification
- Workflow optimization opportunities
- Tool utilization effectiveness

## Analysis Instructions

Based on the data you can gather using available Asana tools, please provide:

1. **Executive Summary**
   - Overall team productivity assessment
   - Key performance indicators
   - Notable trends and patterns

2. **Individual Performance Insights**
   - Top performers and their success factors
   - Team members needing support
   - Skill development opportunities

3. **Process Optimization Recommendations**
   - Workflow improvements
   - Task distribution strategies
   - Communication enhancements
   - Tool usage optimizations

4. **Predictive Insights**
   - Capacity planning recommendations
   - Future performance projections
   - Risk mitigation strategies

5. **Action Plan**
   - Immediate improvements to implement
   - Long-term development goals
   - Success measurement criteria

## Data Collection Strategy

To gather the necessary data, use these Asana operations:
1. Search tasks assigned to team members in the specified time period
2. Analyze task completion patterns and timelines
3. Review project participation and collaboration metrics
4. Examine comment patterns and feedback quality
5. Assess workload distribution and balance

Please format your analysis in a clear, data-driven report suitable for team leads and management review.
    `;
        return {
            prompt: {
                name: 'team-productivity-analysis',
                description: 'Team productivity analysis prompt',
                content: prompt.trim(),
            },
        };
    }
    catch (error) {
        throw new Error(`Failed to generate team productivity analysis prompt: ${error.message}`);
    }
}

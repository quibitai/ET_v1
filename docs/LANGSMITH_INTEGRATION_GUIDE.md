# LangSmith Integration Guide

## Overview
LangSmith provides advanced observability and debugging capabilities for LangChain/LangGraph applications. This guide covers setup, testing, and usage of LangSmith tracing in Echo Tango v1.

## ✅ Setup Complete
The environment configuration has been added to your `.env.local` file. You need to:

1. Get your API key from [https://smith.langchain.com](https://smith.langchain.com)
2. Replace `YOUR_LANGSMITH_API_KEY_HERE` with your actual API key
3. Restart your development server

## Testing the Integration

### Step 1: Restart the Development Server
```bash
# Stop the current server (Ctrl+C) and restart
pnpm dev
```

### Step 2: Test with Complex Queries
Run queries that will trigger LangGraph execution. Here are some examples:

#### Weather + Web Search Query
```
"Find the current weather in New Orleans, then search the web for the best seafood restaurants there."
```

#### Asana + Research Query  
```
"Show me my tasks on Asana, then research Echo Tango's ideal client profile."
```

#### Multi-Tool Document Query
```
"Search our internal knowledge base for information about client onboarding, then create a summary."
```

### Step 3: Verify Traces in LangSmith
1. Go to your LangSmith project dashboard
2. Look for new traces corresponding to your queries
3. Click on a trace to see detailed execution flow

## What You'll See in LangSmith

### Trace Structure
- **Agent Reasoning**: Step-by-step thought process
- **Tool Calls**: Which tools were called and why
- **Inputs/Outputs**: Data flowing between components
- **Timing**: Performance metrics for each step
- **Errors**: Detailed error information if something fails

### Key Metrics
- **Total Execution Time**: End-to-end query processing
- **Tool Execution Time**: Individual tool performance
- **Token Usage**: LLM token consumption
- **Success/Failure Rates**: Reliability metrics

## Troubleshooting

### No Traces Appearing
1. **Check API Key**: Ensure it's correctly set in `.env.local`
2. **Restart Server**: Environment variables require server restart
3. **Check Console**: Look for LangSmith connection errors
4. **Trigger LangGraph**: Simple queries might use Vercel AI, not LangGraph

### Authentication Errors
```bash
# Check if your API key is valid
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.smith.langchain.com/info
```

### Missing Traces for Simple Queries
- Simple queries may be routed to Vercel AI (no LangGraph)
- Use complex queries that require multiple tools
- Check the query classification in the observability dashboard

## Advanced Configuration

### Environment Variables
```bash
# Optional: Track different development sessions
LANGCHAIN_SESSION="development"

# Optional: Custom run naming
LANGSMITH_RUN_NAME_TEMPLATE="{run_type}-{agent_name}-{timestamp}"

# Optional: Enable detailed metadata
LANGCHAIN_METADATA='{"environment":"development","version":"v1.0"}'
```

### Project Organization
- Create separate projects for development, staging, and production
- Use different `LANGCHAIN_PROJECT` values for each environment
- Tag runs with metadata for easier filtering

## Integration Benefits

### For Developers
- **Debug Complex Flows**: See exactly how the AI reasoning works
- **Performance Optimization**: Identify bottlenecks in tool execution
- **Error Analysis**: Detailed failure investigation
- **Testing Validation**: Verify agent behavior in development

### For Product Teams
- **User Journey Analysis**: Understand how users interact with the AI
- **Feature Usage**: See which tools are most/least used
- **Quality Metrics**: Track success rates and response times
- **Cost Analysis**: Monitor token usage and API costs

## Next Steps

1. **Set up your API key** and test basic functionality
2. **Explore the LangSmith dashboard** to understand the interface
3. **Test with complex queries** to see full LangGraph traces
4. **Set up alerts** for errors or performance issues
5. **Create custom dashboards** for key metrics

## Support

- **LangSmith Documentation**: [https://docs.smith.langchain.com/](https://docs.smith.langchain.com/)
- **Community Support**: LangChain Discord or GitHub discussions
- **Echo Tango Issues**: Check our internal documentation or ask the team 
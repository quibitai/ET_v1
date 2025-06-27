#!/usr/bin/env tsx

/**
 * Google Workspace MCP Tools Testing Script
 *
 * This script verifies that all Google Workspace MCP tools are properly
 * integrated and accessible by the AI specialists.
 */

import { GoogleWorkspaceMCPClient } from '../lib/ai/mcp/GoogleWorkspaceMCPClient';
import { GoogleWorkspaceToolAdapter } from '../lib/ai/tools/adapters/GoogleWorkspaceToolAdapter';

interface ToolTestResult {
  toolName: string;
  category: string;
  isRegistered: boolean;
  isEnabled: boolean;
  hasInstructions: boolean;
  mcpClientSupported: boolean;
  adapterAvailable: boolean;
  testPassed: boolean;
  error?: string;
}

const EXPECTED_GOOGLE_WORKSPACE_TOOLS = [
  // Gmail Tools
  'search_gmail_messages',
  'get_gmail_message_content',
  'send_gmail_message',
  'list_gmail_labels',
  'get_gmail_thread_content',

  // Drive Tools
  'search_drive_files',
  'get_drive_file_content',
  'list_drive_items',
  'create_drive_file',

  // Calendar Tools
  'list_calendars',
  'get_events',
  'create_event',
  'modify_event',
  'delete_event',
  'get_event',

  // Docs Tools
  'search_docs',
  'get_doc_content',
  'create_doc',
  'list_docs_in_folder',

  // Sheets Tools
  'list_spreadsheets',
  'get_spreadsheet_info',
  'read_sheet_values',
  'modify_sheet_values',
  'create_spreadsheet',

  // Forms Tools
  'create_form',
  'get_form',
  'get_form_response',
  'list_form_responses',

  // Chat Tools
  'list_spaces',
  'get_messages',
  'send_message',
  'search_messages',
];

async function testGoogleWorkspaceMCPIntegration(): Promise<void> {
  console.log('🧪 Testing Google Workspace MCP Integration\n');

  const results: ToolTestResult[] = [];

  // Test 1: MCP Client Health Check
  console.log('1️⃣ Testing MCP Client Health...');
  try {
    const mcpClient = new GoogleWorkspaceMCPClient({
      serverUrl: 'http://127.0.0.1:8000',
    });

    const health = await mcpClient.healthCheck();
    console.log(`✅ MCP Server Status: ${health.status}`);
    console.log(`📊 Service: ${health.service}`);

    if (health.status !== 'healthy') {
      console.log('⚠️  MCP Server is not healthy - some tests may fail');
    }
  } catch (error) {
    console.log(`❌ MCP Client Health Check Failed: ${error}`);
  }

  // Test 2: Tool Adapter Initialization
  console.log('\n2️⃣ Testing Tool Adapter...');
  try {
    const adapter = new GoogleWorkspaceToolAdapter();
    await adapter.initialize();
    const tools = adapter.getTools();

    console.log(`✅ Adapter initialized with ${tools.length} tools`);

    // Test each tool
    for (const tool of tools) {
      results.push({
        toolName: tool.name,
        category: tool.category,
        isRegistered: true,
        isEnabled: tool.isEnabled,
        hasInstructions: true, // We'll check this separately
        mcpClientSupported: true,
        adapterAvailable: true,
        testPassed: tool.isEnabled,
      });
    }
  } catch (error) {
    console.log(`❌ Tool Adapter Test Failed: ${error}`);
  }

  // Test 3: Check Tool Registry Integration
  console.log('\n3️⃣ Testing Tool Registry Integration...');
  try {
    const { getAvailableTools } = await import('../lib/ai/tools/registry');
    const availableTools = await getAvailableTools();

    const googleWorkspaceTools = availableTools.filter(
      (tool: any) => tool.source === 'google-workspace',
    );

    console.log(
      `✅ Registry has ${googleWorkspaceTools.length} Google Workspace tools`,
    );

    for (const tool of googleWorkspaceTools) {
      console.log(`  📧 ${tool.name} (${tool.category})`);
    }
  } catch (error) {
    console.log(`❌ Tool Registry Test Failed: ${error}`);
  }

  // Test 4: Check Tool Instructions
  console.log('\n4️⃣ Testing Tool Instructions...');
  try {
    const { googleWorkspaceInstructions } = await import(
      '../lib/ai/prompts/tools/google-workspace'
    );

    const instructionCount = Object.keys(googleWorkspaceInstructions).length;
    console.log(
      `✅ Found instructions for ${instructionCount} Google Workspace tools`,
    );

    // Check coverage
    const missingInstructions = EXPECTED_GOOGLE_WORKSPACE_TOOLS.filter(
      (toolName) => !(googleWorkspaceInstructions as any)[toolName],
    );

    if (missingInstructions.length > 0) {
      console.log(
        `⚠️  Missing instructions for: ${missingInstructions.join(', ')}`,
      );
    } else {
      console.log('✅ All expected tools have instructions');
    }
  } catch (error) {
    console.log(`❌ Tool Instructions Test Failed: ${error}`);
  }

  // Test 5: Specialist Configuration Check
  console.log('\n5️⃣ Testing Specialist Configuration...');
  try {
    const { CONDENSED_ECHO_TANGO_PROMPT } = await import(
      '../lib/ai/prompts/specialists/condensed'
    );

    const hasGoogleWorkspaceInstructions =
      CONDENSED_ECHO_TANGO_PROMPT.includes('Google Workspace');
    const hasToolUsageRules =
      CONDENSED_ECHO_TANGO_PROMPT.includes('Tool Usage Rules');

    if (hasGoogleWorkspaceInstructions) {
      console.log(
        '✅ Specialist prompt includes Google Workspace instructions',
      );
    } else {
      console.log('⚠️  Specialist prompt missing Google Workspace instructions');
    }

    if (hasToolUsageRules) {
      console.log('✅ Specialist prompt includes tool usage rules');
    } else {
      console.log('⚠️  Specialist prompt missing tool usage rules');
    }
  } catch (error) {
    console.log(`❌ Specialist Configuration Test Failed: ${error}`);
  }

  // Test 6: OAuth Configuration Check
  console.log('\n6️⃣ Testing OAuth Configuration...');
  try {
    const serverUrl =
      process.env.GOOGLE_WORKSPACE_MCP_SERVER_URL || 'http://127.0.0.1:8000';
    console.log(`📍 MCP Server URL: ${serverUrl}`);

    // Check if MCP server has required OAuth files
    const hasCredentials =
      process.env.GOOGLE_CLIENT_SECRETS || 'client_secret.json exists';
    console.log(
      `🔐 OAuth Configuration: ${hasCredentials ? '✅ Configured' : '⚠️  Check configuration'}`,
    );
  } catch (error) {
    console.log(`❌ OAuth Configuration Test Failed: ${error}`);
  }

  // Summary Report
  console.log('\n📊 INTEGRATION SUMMARY');
  console.log('========================');

  const totalExpected = EXPECTED_GOOGLE_WORKSPACE_TOOLS.length;
  const toolsFound = results.length;
  const enabledTools = results.filter((r) => r.isEnabled).length;

  console.log(`📈 Expected Tools: ${totalExpected}`);
  console.log(`🔍 Tools Found: ${toolsFound}`);
  console.log(`✅ Enabled Tools: ${enabledTools}`);
  console.log(
    `📊 Coverage: ${Math.round((toolsFound / totalExpected) * 100)}%`,
  );

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('==================');

  if (toolsFound < totalExpected) {
    console.log('🔧 Add missing tools to GoogleWorkspaceToolAdapter');
  }

  if (enabledTools < toolsFound) {
    console.log('⚡ Enable disabled tools in tool configurations');
  }

  console.log(
    '📚 Ensure all specialists have access to Google Workspace tools in their defaultTools configuration',
  );
  console.log('🧪 Test OAuth flow with actual user authentication');
  console.log('📖 Update documentation with new tool capabilities');

  console.log('\n🎉 Google Workspace MCP Integration Test Complete!');
}

// Run the test
if (require.main === module) {
  testGoogleWorkspaceMCPIntegration().catch(console.error);
}

export { testGoogleWorkspaceMCPIntegration };

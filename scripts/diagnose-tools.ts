#!/usr/bin/env tsx

/**
 * Tool Diagnostic Script
 *
 * Quick health check for all AI tools to identify issues
 */

import {
  runAsanaDiagnostics,
  formatDiagnostics,
} from '../lib/ai/tools/asana/diagnostics';
import { availableTools } from '../lib/ai/tools';

async function runToolDiagnostics() {
  console.log('🔍 Running Tool System Diagnostics...\n');

  // 1. Check tool loading
  console.log('📋 Available Tools Check:');
  try {
    console.log(`✅ Successfully loaded ${availableTools.length} tools`);
    availableTools.forEach((tool, index) => {
      console.log(
        `   ${index + 1}. ${tool.name} - ${tool.description.slice(0, 50)}...`,
      );
    });
  } catch (error) {
    console.log(
      `❌ Failed to load tools: ${error instanceof Error ? error.message : error}`,
    );
  }

  console.log('\n');

  // 2. Run Asana diagnostics
  console.log('🔧 Asana Tool Diagnostics:');
  try {
    const asanaDiagnostics = await runAsanaDiagnostics();
    console.log(formatDiagnostics(asanaDiagnostics));
  } catch (error) {
    console.log(
      `❌ Asana diagnostics failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  // 3. Environment check
  console.log('\n🌍 Environment Configuration:');
  const envVars = [
    'OPENAI_API_KEY',
    'ASANA_PAT',
    'NATIVE_ASANA_PAT',
    'ASANA_DEFAULT_WORKSPACE_GID',
    'TAVILY_API_KEY',
  ];

  envVars.forEach((envVar) => {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: Configured (${value.slice(0, 10)}...)`);
    } else {
      console.log(`❌ ${envVar}: Not set`);
    }
  });

  console.log('\n📊 Diagnostic Summary:');
  console.log('- Run this script regularly to monitor tool health');
  console.log(
    '- Check the TOOL_CALLING_OPTIMIZATION_REPORT.md for detailed improvement plan',
  );
  console.log('- Focus on fixing Asana tool configuration first');
}

if (require.main === module) {
  runToolDiagnostics().catch(console.error);
}

export { runToolDiagnostics };

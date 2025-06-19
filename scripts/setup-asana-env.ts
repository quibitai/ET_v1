#!/usr/bin/env tsx

/**
 * Asana Environment Setup Script for Development Mode
 *
 * This script helps configure environment variables for the simplified
 * Personal Access Token approach, bypassing OAuth entirely.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

async function setupAsanaEnvironment() {
  console.log('🚀 Setting up Asana MCP for Development Mode...\n');

  const envPath = join(process.cwd(), '.env.local');

  // Check if .env.local exists
  if (!existsSync(envPath)) {
    console.error('❌ .env.local file not found');
    console.log('💡 Please create .env.local file first');
    process.exit(1);
  }

  // Read current .env.local
  const envContent = readFileSync(envPath, 'utf-8');

  // Check if ASANA_ACCESS_TOKEN is already set
  if (
    envContent.includes('ASANA_ACCESS_TOKEN=') &&
    !envContent.includes('ASANA_ACCESS_TOKEN=your_')
  ) {
    console.log('✅ ASANA_ACCESS_TOKEN appears to already be configured');
  } else {
    console.log('❌ ASANA_ACCESS_TOKEN not found or not configured');
    console.log('\n📋 To complete setup:');
    console.log('1. Visit: https://app.asana.com/0/my-apps');
    console.log('2. Create a new Personal Access Token');
    console.log('3. Add this line to your .env.local:');
    console.log('   ASANA_ACCESS_TOKEN=your_token_here');
    console.log('');
  }

  // Check current configuration
  console.log('📊 Current Configuration:');
  console.log(
    `   ASANA_ACCESS_TOKEN: ${process.env.ASANA_ACCESS_TOKEN ? 'SET' : 'NOT_SET'}`,
  );
  console.log(
    `   ASANA_MCP_SERVER_URL: ${process.env.ASANA_MCP_SERVER_URL || 'NOT_SET'}`,
  );
  console.log(
    `   ASANA_WORKSPACE_GID: ${process.env.ASANA_WORKSPACE_GID || 'NOT_SET'}`,
  );

  // Provide quick setup template if not configured
  if (!process.env.ASANA_ACCESS_TOKEN) {
    console.log('\n📝 Quick Setup Template - Add to .env.local:');
    console.log(
      '# =============================================================================',
    );
    console.log('# ASANA MCP DEVELOPMENT MODE');
    console.log(
      '# =============================================================================',
    );
    console.log('ASANA_ACCESS_TOKEN=your_asana_personal_access_token_here');
    console.log('ASANA_MCP_SERVER_URL=npm:@roychri/mcp-server-asana');
    console.log('ASANA_WORKSPACE_GID=your_workspace_gid_optional');
    console.log('ASANA_DEFAULT_TEAM_GID=your_team_gid_optional');
    console.log('');
  }

  console.log('🎯 Benefits of Development Mode:');
  console.log('   ✅ No OAuth flow required');
  console.log('   ✅ Simple Personal Access Token');
  console.log('   ✅ Works immediately after setup');
  console.log('   ✅ Bypasses database authentication');
  console.log('');

  console.log('🧪 Test your setup:');
  console.log('   1. Restart your dev server: pnpm dev');
  console.log('   2. Visit: http://localhost:3000/api/test-asana-mcp');
  console.log('   3. Look for: "authMethod": "environment_variable"');
  console.log('');
}

// Run the setup
setupAsanaEnvironment().catch(console.error);

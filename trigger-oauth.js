// Simple script to trigger Google Workspace OAuth flow
const {
  GoogleWorkspaceMCPClient,
} = require('./lib/ai/mcp/GoogleWorkspaceMCPClient.ts');

async function triggerOAuth() {
  try {
    console.log('🔧 Initializing Google Workspace MCP Client...');

    const client = await GoogleWorkspaceMCPClient.create({
      serverUrl: 'http://localhost:8001',
      timeout: 30000,
    });

    console.log('✅ Client initialized successfully');
    console.log('🔑 Attempting to trigger OAuth flow...');

    // Replace with your actual email
    const userEmail = 'your-email@gmail.com';

    try {
      // This should trigger the OAuth flow
      const result = await client.executeTool('start_google_auth', {
        user_google_email: userEmail,
        service_name: 'Google Calendar',
      });

      console.log('📋 OAuth Response:');
      console.log(result);
    } catch (error) {
      console.log(
        '🔗 OAuth flow triggered! Check the server logs for the authorization URL.',
      );
      console.log('Error (expected):', error.message);
    }
  } catch (error) {
    console.error('❌ Failed to connect to MCP server:', error.message);
    console.log('\n💡 Make sure the Google Workspace MCP server is running:');
    console.log(
      '   docker-compose -f docker-compose.dev.yml up google-workspace-mcp',
    );
  }
}

// Get email from command line or use placeholder
const userEmail = process.argv[2] || 'your-email@gmail.com';

if (userEmail === 'your-email@gmail.com') {
  console.log('📧 Please provide your Google email as an argument:');
  console.log('   node trigger-oauth.js your-email@gmail.com');
  process.exit(1);
}

console.log(`🚀 Starting OAuth flow for: ${userEmail}`);
triggerOAuth();

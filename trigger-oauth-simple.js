// Trigger OAuth by attempting to use a Google Workspace tool
// This will fail but should generate the OAuth URL in the server logs

const userEmail = process.argv[2];

if (!userEmail || !userEmail.includes('@')) {
  console.log('📧 Please provide your Google email as an argument:');
  console.log('   node trigger-oauth-simple.js your-email@gmail.com');
  process.exit(1);
}

console.log(`🚀 Triggering OAuth flow for: ${userEmail}`);
console.log('📋 This will attempt to call a Google Calendar tool...');
console.log('⚠️  Expected to fail - check the Docker logs for the OAuth URL!');
console.log('');

// Simple HTTP request to trigger authentication
const http = require('node:http');

const postData = JSON.stringify({
  user_google_email: userEmail,
});

const options = {
  hostname: 'localhost',
  port: 8001,
  path: '/tools/list_calendars',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = http.request(options, (res) => {
  console.log(`📡 Response status: ${res.statusCode}`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📋 Response:', data);
    console.log('');
    console.log('🔍 Now check the Docker logs for the OAuth URL:');
    console.log('   docker logs google-workspace-mcp');
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
  console.log('');
  console.log('💡 Make sure the Google Workspace MCP server is running:');
  console.log(
    '   docker-compose -f docker-compose.dev.yml up google-workspace-mcp',
  );
});

req.write(postData);
req.end();

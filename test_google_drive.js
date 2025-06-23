const fetch = require('node-fetch');

async function testGoogleDrive() {
  try {
    console.log('Testing Google Drive integration...');
    
    const response = await fetch('http://localhost:3000/api/brain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'List my recent Google Drive files',
        chatId: 'test-google-drive-' + Date.now(),
        contextId: 'echo-tango-specialist'
      })
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.text();
      console.log('Response received. Length:', data.length);
      
      // Look for key indicators
      if (data.includes('Google Drive')) {
        console.log('✅ Google Drive functionality detected');
      }
      if (data.includes('error')) {
        console.log('❌ Error detected in response');
      }
    } else {
      console.log('❌ Request failed:', response.statusText);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testGoogleDrive();

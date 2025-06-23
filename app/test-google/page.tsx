'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState } from 'react';

export default function TestGooglePage() {
  const { data: session, status } = useSession();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const handleSignIn = () => {
    signIn('google', { callbackUrl: '/test-google' });
  };

  const handleReAuth = () => {
    // This will sign the user out and then redirect them to the google sign-in page
    signIn('google', { callbackUrl: '/test-google' }, { prompt: 'consent' });
  };

  const addResult = (message: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const testGoogleWorkspace = async () => {
    if (!session?.accessToken) {
      addResult('❌ No access token found. Please sign in with Google.');
      return;
    }

    setTesting(true);
    setTestResults([]);
    addResult('🧪 Starting Google Workspace Integration Test...');

    try {
      // Test the MCP server directly
      const response = await fetch('http://localhost:8000/mcp/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${session.accessToken}`,
          'X-Session-ID': session.user?.email || 'test-session',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addResult('✅ MCP Server responded successfully');
        addResult(
          `📊 Found ${data.result?.tools?.length || 0} Google Workspace tools`,
        );

        // Test a simple tool call
        const driveResponse = await fetch('http://localhost:8000/mcp/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: `Bearer ${session.accessToken}`,
            'X-Session-ID': session.user?.email || 'test-session',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'gdrive_list_files',
              arguments: {
                query: 'type:document',
                max_results: 5,
              },
            },
          }),
        });

        if (driveResponse.ok) {
          const driveData = await driveResponse.json();
          addResult('✅ Google Drive access successful');
          addResult(
            `📁 Found ${
              driveData.result?.content?.[0]?.text ? 'files' : 'no files'
            }`,
          );
        } else {
          addResult('⚠️ Google Drive test failed');
        }
      } else {
        addResult(
          `❌ MCP Server error: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      addResult(
        `❌ Test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    setTesting(false);
    addResult('🎉 Test completed!');
  };

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Google Workspace Integration Test
      </h1>

      {!session ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          <p>
            Please{' '}
            <button
              type="button"
              onClick={handleSignIn}
              className="underline font-bold"
            >
              sign in with Google
            </button>{' '}
            to test the integration.
          </p>
        </div>
      ) : session.accessToken ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          <p>✅ Signed in as: {session.user?.email}</p>
          <p>🔑 Access token: Available</p>
        </div>
      ) : (
        <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded mb-6">
          <p>⚠️ Signed in as: {session.user?.email}</p>
          <p>🔑 Access token: Missing</p>
          <p className="mt-2 text-sm">
            <strong>Fix:</strong> You need to sign out and sign back in with
            Google to capture the access token.
          </p>
          <div className="mt-2 space-x-4">
            <button
              type="button"
              onClick={handleReAuth}
              className="text-orange-800 underline hover:text-orange-900"
            >
              Sign out and re-authenticate with Google
            </button>
            <span className="text-gray-500">or</span>
            <button
              type="button"
              onClick={handleSignIn}
              className="text-blue-600 underline hover:text-blue-700"
            >
              Sign in with Google directly
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={testGoogleWorkspace}
        disabled={!session || testing}
        className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 mb-6"
      >
        {testing ? 'Testing...' : 'Test Google Workspace Integration'}
      </button>

      {testResults.length > 0 && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Test Results:</h3>
          <div className="space-y-1 font-mono text-sm">
            {testResults.map((result) => (
              <div key={result}>{result}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

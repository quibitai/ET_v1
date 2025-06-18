'use client';

import { useChat } from '@ai-sdk/react';
// Artifact system has been removed - no longer needed

export function ChatSimple() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: '/api/chat',
    });

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div key={message.id} className="space-y-4">
            {/* Message content */}
            <div
              className={`p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-100 ml-auto max-w-[80%]'
                  : 'bg-gray-100 mr-auto max-w-[80%]'
              }`}
            >
              <div className="font-medium mb-1">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div>{message.content}</div>
            </div>

            {/* Tool invocations - artifact system removed */}
            {message.toolInvocations?.map((toolInvocation) => {
              const { toolName, toolCallId, state } = toolInvocation;

              if (state === 'result') {
                // Simple display for tool results without artifact rendering
                return (
                  <div
                    key={toolCallId}
                    className="my-4 p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="font-medium text-green-800">
                      Tool Result: {toolName}
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                      {JSON.stringify(toolInvocation.result, null, 2)}
                    </div>
                  </div>
                );
              } else {
                // Show loading state for pending tool calls
                return (
                  <div
                    key={toolCallId}
                    className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className="animate-spin size-4 border-2 border-yellow-600 border-t-transparent rounded-full" />
                      <span>Running tool: {toolName}...</span>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        ))}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask me to create a document, code, or data sheet..."
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

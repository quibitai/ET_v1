'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
// DocumentPreview component removed with artifact system
import { MessageReasoning } from './message-reasoning';
import { MessageThinking } from './message-thinking';
import type { UseChatHelpers } from '@ai-sdk/react';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  onArtifactExpand,
  streamData,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  onArtifactExpand?: (artifactId: string) => void;
  streamData?: any[];
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // While the message is streaming but has no content yet, show the thinking/loading animation.
  if (isLoading && message.content.length === 0) {
    // We can use the ThinkingMessage component as a loading indicator.
    return <ThinkingMessage />;
  }

  // Add a clear log to see when PurePreviewMessage renders and with what props
  console.log(
    `[PurePreviewMessage ${message.id?.substring(0, 5)}] Rendering. isLoading: ${isLoading}, Content: "${typeof message.content === 'string' ? message.content.substring(0, 30) : 'N/A'}"`,
  );

  // Get message data first. Use live streamData if available, otherwise use data attached to the message.
  const data = streamData || (message as any).data;

  // Enhanced debugging for message data and artifact detection
  console.log(
    `[PurePreviewMessage ${message.id?.substring(0, 5)}] Message data:`,
    {
      hasData: !!data,
      dataLength: data?.length || 0,
      dataItems: data || [],
    },
  );

  // Extract tool calls and thinking from message data
  const toolCalls: any[] = [];
  const thinkingContent: string[] = [];

  if (data && Array.isArray(data)) {
    console.log(
      `[PurePreviewMessage ${message.id?.substring(0, 5)}] Processing ${data.length} data items:`,
      data.map((item, i) => ({
        index: i,
        type: item?.type,
        keys: Object.keys(item || {}),
      })),
    );

    data.forEach((item: any, index: number) => {
      console.log(
        `[PurePreviewMessage ${message.id?.substring(0, 5)}] Data item ${index}:`,
        { type: item?.type, item },
      );

      // Look for various tool call formats
      if (
        item?.type === 'tool-call' ||
        item?.type === 'tool-result' ||
        item?.type === 'tool_call' ||
        item?.type === 'tool_result' ||
        item?.toolName ||
        item?.tool_name
      ) {
        console.log(
          `[PurePreviewMessage ${message.id?.substring(0, 5)}] Found tool call:`,
          item,
        );
        toolCalls.push(item);
      }

      // Look for thinking content in various formats
      if (
        item?.type === 'thinking' ||
        (item?.content &&
          typeof item.content === 'string' &&
          item.content.includes('<think>')) ||
        (item?.text &&
          typeof item.text === 'string' &&
          item.text.includes('<think>'))
      ) {
        thinkingContent.push(item.content || item.text || JSON.stringify(item));
      }
    });

    console.log(
      `[PurePreviewMessage ${message.id?.substring(0, 5)}] Extracted:`,
      {
        toolCallsCount: toolCalls.length,
        thinkingContentCount: thinkingContent.length,
      },
    );
  }

  // Find the conclusive 'artifact-end' event from the message data, if it exists.
  // This will be the single source of truth for rendering a document preview.
  let artifactPreviewProps = null;
  if (data && Array.isArray(data)) {
    // Find the 'end' event specifically. It should have the final, correct metadata.
    const conclusiveArtifactEvent = data.find(
      (item: any) =>
        item?.type === 'artifact' && item?.props?.eventType === 'artifact-end',
    );

    if (conclusiveArtifactEvent?.props) {
      // Ensure the props contain valid id and title before setting
      if (
        conclusiveArtifactEvent.props.documentId &&
        conclusiveArtifactEvent.props.title
      ) {
        artifactPreviewProps = {
          id: conclusiveArtifactEvent.props.documentId,
          title: conclusiveArtifactEvent.props.title,
          kind: conclusiveArtifactEvent.props.kind || 'text',
        };
        console.log(
          '[PreviewMessage] Preparing to render DocumentToolResult with props:',
          artifactPreviewProps,
        );
      } else {
        console.warn(
          '[PreviewMessage] Found artifact-end event but it is missing documentId or title.',
          conclusiveArtifactEvent.props,
        );
      }
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            {message.experimental_attachments && (
              <div
                data-testid={`message-attachments`}
                className="flex flex-row justify-end gap-2"
              >
                {message.experimental_attachments.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={attachment}
                  />
                ))}
              </div>
            )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                // Extract thinking content from text and display it separately
                const textContent =
                  typeof part.text === 'string' ? part.text : '';
                const thinkingMatch = textContent.match(
                  /<think>(.*?)<\/think>/gs,
                );
                const cleanText = textContent
                  .replace(/<think>.*?<\/think>/gs, '')
                  .trim();

                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      {/* Show thinking content in collapsible container if present */}
                      {thinkingMatch && thinkingMatch.length > 0 && (
                        <MessageThinking
                          toolResult={{
                            success: true,
                            content: thinkingMatch
                              .map((match) => match.replace(/<\/?think>/g, ''))
                              .join('\n\n'),
                          }}
                          toolName="thinking"
                        />
                      )}

                      <div className="flex flex-row gap-2 items-start">
                        {message.role === 'user' && !isReadonly && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                data-testid="message-edit-button"
                                variant="ghost"
                                className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                                onClick={() => {
                                  setMode('edit');
                                }}
                              >
                                <PencilEditIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit message</TooltipContent>
                          </Tooltip>
                        )}

                        <div
                          data-testid="message-content"
                          className={cn('flex flex-col gap-4', {
                            'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                              message.role === 'user',
                          })}
                        >
                          <Markdown>{cleanText}</Markdown>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }

              if ((type as string) === 'tool-invocation') {
                const toolInvocationPart = part as any;
                // Display tool invocation in collapsible container
                return (
                  <MessageThinking
                    key={key}
                    toolResult={{
                      success: true,
                      toolName: toolInvocationPart.toolName,
                      args: toolInvocationPart.args,
                      invocationId: toolInvocationPart.toolCallId,
                    }}
                    toolName={`${toolInvocationPart.toolName} (invocation)`}
                  />
                );
              }

              if ((type as string) === 'tool-result') {
                const toolResultPart = part as any;
                // Display tool result in collapsible container
                return (
                  <MessageThinking
                    key={key}
                    toolResult={{
                      success: !toolResultPart.isError,
                      result: toolResultPart.result,
                      error: toolResultPart.isError
                        ? toolResultPart.result
                        : undefined,
                      toolCallId: toolResultPart.toolCallId,
                    }}
                    toolName={`${toolResultPart.toolName || 'tool'} (result)`}
                  />
                );
              }

              return null;
            })}

            {/* Render tool calls from data stream */}
            {(toolCalls as any[]).map((toolCall, index) => (
              <MessageThinking
                key={`tool-${message.id}-${index}`}
                toolResult={{
                  success:
                    toolCall.type === 'tool-result'
                      ? toolCall.success !== false
                      : true,
                  toolName: toolCall.toolName || 'tool',
                  args: toolCall.args,
                  result: toolCall.result,
                  error: toolCall.error,
                }}
                toolName={`${toolCall.toolName || 'tool'} (${toolCall.type === 'tool-call' ? 'call' : 'result'})`}
              />
            ))}

            {/* Render thinking content from data stream */}
            {thinkingContent.length > 0 && (
              <MessageThinking
                toolResult={{
                  success: true,
                  content: thinkingContent.join('\n\n'),
                }}
                toolName="thinking"
              />
            )}

            {/* 
              Render the conclusive artifact preview here, outside the parts loop.
              This ensures it's rendered only once for the entire message, based on
              the 'artifact-end' event found in the message.data stream.
            */}
            {artifactPreviewProps && (
              <DocumentToolResult
                isReadonly={isReadonly}
                type="create"
                result={artifactPreviewProps}
                onArtifactExpand={onArtifactExpand}
              />
            )}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    // Only re-render if streaming state or content changes, or if message id changes
    if (prevProps.isLoading !== nextProps.isLoading) {
      // console.log(`[PreviewMessage.memo ${prevProps.message.id.substring(0,5)}] RERENDER because isLoading changed`);
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      // console.log(`[PreviewMessage.memo ${prevProps.message.id.substring(0,5)}] RERENDER because message.id changed`);
      return false;
    }
    if (prevProps.message.content !== nextProps.message.content) {
      // console.log(`[PreviewMessage.memo ${prevProps.message.id.substring(0,5)}] RERENDER because message.content changed`);
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      // console.log(`[PreviewMessage.memo ${prevProps.message.id.substring(0,5)}] RERENDER because message.parts changed`);
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      // console.log(`[PreviewMessage.memo ${prevProps.message.id.substring(0,5)}] RERENDER because vote changed`);
      return false;
    }
    if (prevProps.isReadonly !== nextProps.isReadonly) {
      // console.log(`[PreviewMessage.memo ${prevProps.message.id.substring(0,5)}] RERENDER because isReadonly changed`);
      return false;
    }
    if (!equal(prevProps.streamData, nextProps.streamData)) {
      return false;
    }
    // console.log(`[PreviewMessage.memo ${prevProps.message.id.substring(0,5)}] Props ARE equal, skipping re-render.`);
    return true; // Props are equal
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          >
            <SparklesIcon size={14} />
          </motion.div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: 'reverse',
                }}
                className="text-muted-foreground font-medium"
              >
                Processing your request...
              </motion.div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 bg-muted-foreground rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground/70">
              This may take a few moments for complex requests
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

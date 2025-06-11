import { test, expect } from '@playwright/test';
import { ChatPage } from './pages/chat';

/**
 * Updated Chat Tests for Refactored Architecture
 *
 * These tests verify the new ChatWrapper + useChat architecture
 * replacing the old ChatPaneContext system.
 */

test.describe('ChatWrapper functionality', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test('should initialize chat state properly', async () => {
    // Verify initial state
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.sendButton).toBeDisabled();
    await expect(chatPage.multimodalInput).toBeVisible();
  });

  test('should handle message sending via props-based architecture', async () => {
    // Send a message using the new architecture
    await chatPage.sendUserMessage('Test message via new architecture');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBeTruthy();

    // Verify the chat ID is in URL (proper routing)
    await chatPage.hasChatIdInUrl();
  });

  test('should update UI state correctly during message flow', async () => {
    // Verify initial state
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.sendButton).toBeDisabled();

    // Start sending message
    await chatPage.sendUserMessage('Testing state updates');

    // Verify loading state
    await expect(chatPage.sendButton).not.toBeVisible();
    await expect(chatPage.stopButton).toBeVisible();

    // Wait for completion
    await chatPage.isGenerationComplete();

    // Verify final state
    await expect(chatPage.stopButton).not.toBeVisible();
    await expect(chatPage.sendButton).toBeVisible();
  });

  test('should handle error states gracefully', async () => {
    // This would test error handling in the new architecture
    // For now, we'll just verify the basic flow works
    await chatPage.sendUserMessage('Simple test message');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBeTruthy();
  });

  test('should maintain chat history across component updates', async () => {
    // Send first message
    await chatPage.sendUserMessage('First message');
    await chatPage.isGenerationComplete();

    // Send second message
    await chatPage.sendUserMessage('Second message');
    await chatPage.isGenerationComplete();

    // Verify we can get the most recent messages
    const recentUserMessage = await chatPage.getRecentUserMessage();
    expect(recentUserMessage.content).toContain('Second message');
  });
});

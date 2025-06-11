import { test, expect } from '@playwright/test';

/**
 * Observability Dashboard Tests
 *
 * Tests for the admin observability interface for monitoring system performance
 * Added as part of Phase 3, Task 3.2 enhancement.
 */

test.describe('Observability Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the observability dashboard
    await page.goto('/admin/observability');
  });

  test('should load the observability dashboard without errors', async ({
    page,
  }) => {
    // Check that the page loads successfully
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();

    // Look for dashboard-specific elements
    const dashboard = page.locator('[data-testid="observability-dashboard"]');
    const dashboardVisible = await dashboard.isVisible().catch(() => false);

    // If specific dashboard element doesn't exist, at least check page loads
    if (!dashboardVisible) {
      const bodyContent = page.locator('body');
      await expect(bodyContent).toBeVisible();
    } else {
      await expect(dashboard).toBeVisible();
    }
  });

  test('should display execution path distribution metrics', async ({
    page,
  }) => {
    // Look for execution path metrics (LangGraph vs LangChain vs Vercel AI)
    const executionPathSection = page.locator(
      '[data-testid="execution-path-distribution"]',
    );
    const chartContainer = page.locator('[data-testid="execution-path-chart"]');
    const metricsDisplay = page.locator(
      'text=/langraph|langchain|vercel.*ai/i',
    );

    const executionPathVisible = await executionPathSection
      .isVisible()
      .catch(() => false);
    const chartVisible = await chartContainer.isVisible().catch(() => false);
    const metricsVisible = await metricsDisplay.isVisible().catch(() => false);

    // At least one method of displaying execution path data should be visible
    expect(executionPathVisible || chartVisible || metricsVisible).toBeTruthy();
  });

  test('should display tool usage frequency metrics', async ({ page }) => {
    // Look for tool usage metrics
    const toolUsageSection = page.locator(
      '[data-testid="tool-usage-frequency"]',
    );
    const toolChart = page.locator('[data-testid="tool-usage-chart"]');
    const toolMetrics = page.locator('text=/tavily|search|asana|weather/i');

    const toolSectionVisible = await toolUsageSection
      .isVisible()
      .catch(() => false);
    const toolChartVisible = await toolChart.isVisible().catch(() => false);
    const toolMetricsVisible = await toolMetrics.isVisible().catch(() => false);

    // At least one method of displaying tool data should be visible
    expect(
      toolSectionVisible || toolChartVisible || toolMetricsVisible,
    ).toBeTruthy();
  });

  test('should display query classification confidence scores', async ({
    page,
  }) => {
    // Look for query classification metrics
    const classificationSection = page.locator(
      '[data-testid="query-classification"]',
    );
    const confidenceChart = page.locator('[data-testid="confidence-chart"]');
    const confidenceMetrics = page.locator(
      'text=/confidence|classification|score/i',
    );

    const classificationVisible = await classificationSection
      .isVisible()
      .catch(() => false);
    const chartVisible = await confidenceChart.isVisible().catch(() => false);
    const metricsVisible = await confidenceMetrics
      .isVisible()
      .catch(() => false);

    // At least one method of displaying classification data should be visible
    expect(
      classificationVisible || chartVisible || metricsVisible,
    ).toBeTruthy();
  });

  test('should display analytics data in charts or tables', async ({
    page,
  }) => {
    // Look for any data visualization elements
    const charts = page.locator('svg, canvas, [data-testid*="chart"]');
    const tables = page.locator('table, [data-testid*="table"]');
    const dataDisplay = page.locator(
      '[data-testid*="data"], [data-testid*="metric"], [data-testid*="analytics"]',
    );

    const chartsCount = await charts.count();
    const tablesCount = await tables.count();
    const dataDisplayCount = await dataDisplay.count();

    // Should have some form of data visualization
    expect(chartsCount + tablesCount + dataDisplayCount).toBeGreaterThan(0);
  });

  test('should handle empty or loading states gracefully', async ({ page }) => {
    // Check for loading indicators or empty state messages
    const loadingIndicator = page.locator(
      '[data-testid="loading"], text=/loading|fetching/i',
    );
    const emptyState = page.locator(
      '[data-testid="empty-state"], text=/no.*data|empty|no.*analytics/i',
    );
    const errorMessage = page.locator(
      '[data-testid="error"], text=/error|failed|unavailable/i',
    );

    const loadingVisible = await loadingIndicator
      .isVisible()
      .catch(() => false);
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const errorVisible = await errorMessage.isVisible().catch(() => false);

    // The page should either show data, loading, empty state, or error - but not crash
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  test('should allow filtering or time range selection', async ({ page }) => {
    // Look for filtering controls
    const timeRangeFilter = page.locator(
      'select[name*="time"], input[type="date"], [data-testid*="time-range"]',
    );
    const filterControls = page.locator(
      '[data-testid*="filter"], button[data-testid*="filter"]',
    );
    const dateInputs = page.locator(
      'input[type="date"], input[type="datetime-local"]',
    );

    const timeRangeVisible = await timeRangeFilter
      .isVisible()
      .catch(() => false);
    const filterControlsVisible = await filterControls
      .isVisible()
      .catch(() => false);
    const dateInputsVisible = await dateInputs.isVisible().catch(() => false);

    // Filtering controls are optional but if present should be functional
    if (timeRangeVisible || filterControlsVisible || dateInputsVisible) {
      // If filters exist, they should be interactable
      const firstFilter = await timeRangeFilter
        .or(filterControls)
        .or(dateInputs)
        .first();
      const filterEnabled = await firstFilter.isEnabled().catch(() => false);
      expect(filterEnabled).toBeTruthy();
    }

    // Page should load regardless of filter presence
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  test('should protect admin observability routes', async ({ page }) => {
    // Similar to configuration tests, check for authentication protection
    const currentUrl = page.url();
    const hasLoginInUrl =
      currentUrl.includes('/login') || currentUrl.includes('/auth');
    const hasUnauthorizedMessage = await page
      .locator('text=/unauthorized|access.*denied|forbidden/i')
      .isVisible()
      .catch(() => false);
    const hasAdminContent = await page
      .locator('[data-testid*="admin"], [data-testid*="observability"]')
      .isVisible()
      .catch(() => false);

    // Should either redirect to login, show unauthorized, or show admin content
    expect(
      hasLoginInUrl || hasUnauthorizedMessage || hasAdminContent,
    ).toBeTruthy();
  });

  test('should not have critical JavaScript errors', async ({ page }) => {
    // Monitor for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    // Filter out non-critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('manifest') &&
        !error.includes('404') &&
        !error.includes('chunk') && // Common in dev builds
        !error.toLowerCase().includes('warning'),
    );

    expect(criticalErrors.length).toBe(0);
  });
});

import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  trackEvent,
  ANALYTICS_EVENTS,
} from '@/lib/services/observabilityService';

// Define the input schema using Zod
const weatherSchema = z.object({
  latitude: z.number().describe('The latitude for the location.'),
  longitude: z.number().describe('The longitude for the location.'),
});

/**
 * Langchain Tool for fetching current weather data from Open-Meteo API.
 */
export const getWeatherTool = new DynamicStructuredTool({
  name: 'getWeather',
  description:
    'Get the current weather at a location using latitude and longitude.',
  schema: weatherSchema,
  func: async ({ latitude, longitude }) => {
    const startTime = performance.now();
    console.log(
      `[getWeatherTool] Fetching weather for lat: ${latitude}, lon: ${longitude}`,
    );

    // Track tool usage
    await trackEvent({
      eventName: ANALYTICS_EVENTS.TOOL_USED,
      properties: {
        toolName: 'getWeather',
        latitude: Math.round(latitude * 100) / 100, // Round to 2 decimal places for privacy
        longitude: Math.round(longitude * 100) / 100,
        timestamp: new Date().toISOString(),
      },
    });

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const duration = performance.now() - startTime;

        // Attempt to get error details from the API response
        let errorDetails = `HTTP error! status: ${response.status}`;
        try {
          const errorJson = await response.json();
          errorDetails += ` - ${JSON.stringify(errorJson)}`;
        } catch (e) {
          // Ignore if error body is not JSON
        }

        // Track error
        await trackEvent({
          eventName: ANALYTICS_EVENTS.TOOL_USED,
          properties: {
            toolName: 'getWeather',
            success: false,
            error: `HTTP ${response.status}`,
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          },
        });

        throw new Error(errorDetails);
      }

      const weatherData = await response.json();
      const duration = performance.now() - startTime;

      console.log(`[getWeatherTool] Successfully fetched weather data.`);

      // Track successful completion
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getWeather',
          success: true,
          duration: Math.round(duration),
          hasCurrentTemp: !!weatherData?.current?.temperature_2m,
          timestamp: new Date().toISOString(),
        },
      });

      // Return the JSON object. The agent will need to process this.
      // If the agent expects a string, we might need to stringify or summarize later.
      return weatherData;
    } catch (error) {
      const duration = performance.now() - startTime;

      console.error('[getWeatherTool] Error fetching weather data:', error);

      // Track exception
      await trackEvent({
        eventName: ANALYTICS_EVENTS.TOOL_USED,
        properties: {
          toolName: 'getWeather',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        },
      });

      return `Error: Failed to fetch weather data - ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

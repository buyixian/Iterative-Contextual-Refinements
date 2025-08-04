/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";

// Define the parameters interface for generateContent, mirroring the structure used in openai-client.ts
// This is to maintain compatibility with the existing callGemini function in index.tsx
export interface GenerateContentParameters {
  model: string;
  contents: { parts: Part[] };
  config?: any;
}

/**
 * A wrapper around GoogleGenAI that implements intelligent key rotation.
 * If an API call fails due to authentication or quota issues (401, 403, 429),
 * it will automatically try the next available API key until all keys are exhausted.
 */
export class GeminiAPI {
  private clients: GoogleGenAI[];
  private modelNames: string[]; // To store model names for each client if needed in the future

  /**
   * @param apiKeys An array of Google GenAI API keys
   * @param modelName The default model name to use (optional)
   */
  constructor(apiKeys: string[], modelName?: string) {
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error("At least one API key must be provided.");
    }

    // Create a GoogleGenAI client for each API key
    this.clients = apiKeys.map(key => new GoogleGenAI({ apiKey: key }));
    // For now, we don't store modelName per client, but we could if needed
    this.modelNames = apiKeys.map(() => modelName || 'gemini-1.5-pro-002'); // Default model
  }

  /**
   * Get the models object with a generateContent method that implements key rotation
   */
  get models() {
    return {
      /**
       * Generate content using Google GenAI, with intelligent key rotation.
       * @param params The parameters for content generation
       * @returns A Promise that resolves to the generated content response
       */
      generateContent: async (params: GenerateContentParameters): Promise<GenerateContentResponse> => {
        // Try each client in sequence until one succeeds or all fail
        let lastError: any = null;

        for (let i = 0; i < this.clients.length; i++) {
          try {
            // Attempt to generate content with the current client
            const response = await this.clients[i].models.generateContent(params);
            return response;
          } catch (error: any) {
            // Check if the error is related to authentication or quota
            // Note: The exact error structure from @google/genai might differ from OpenAI's fetch response
            // We'll assume it has a status property for HTTP-like errors, or check the message
            const isAuthOrQuotaError = 
              (error.status && (error.status === 401 || error.status === 403 || error.status === 429)) ||
              (error.message && (
                error.message.includes('API_KEY_INVALID') ||
                error.message.includes('PERMISSION_DENIED') ||
                error.message.includes('RESOURCE_EXHAUSTED')
              ));

            if (isAuthOrQuotaError) {
              lastError = error;
              console.warn(`Gemini API key ${i + 1} failed with auth/quota error. Trying next key...`);
              continue; // Try the next key
            } else {
              // For other errors (e.g., bad request, internal server error), re-throw immediately
              // as they are unlikely to be resolved by trying a different key
              console.error(`Gemini API key ${i + 1} failed with non-retryable error:`, error);
              throw error;
            }
          }
        }

        // If we've exhausted all keys, throw the last error we encountered
        throw lastError || new Error("All Gemini API keys failed.");
      }
    };
  }
}
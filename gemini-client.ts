/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import {
  GenerateContentParameters,
  GenerateContentStreamResponse,
  AIError
} from "./types/ai";

/**
 * A wrapper around GoogleGenAI that implements intelligent key rotation.
 * If an API call fails due to authentication or quota issues (401, 403, 429),
 * it will automatically try the next available API key until all keys are exhausted.
 */
export class GeminiAPI implements AIClient {
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
   * Generate content using Google GenAI, with intelligent key rotation.
   * @param params The parameters for content generation
   * @returns A Promise that resolves to the generated content response
   */
  async generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    // Try each client in sequence until one succeeds or all fail
    let lastError: any = null;

    for (let i = 0; i < this.clients.length; i++) {
      try {
        // Attempt to generate content with the current client
        const response = await this.clients[i].models.generateContent(params);
        
        // Convert the response to our unified format
        return {
          text: response.text,
          candidates: response.candidates
        };
      } catch (error: any) {
        // Check if the error is a client-side error (like 400 Bad Request)
        // that won't be solved by retrying with a different key.
        const isClientError =
          (error.status && error.status >= 400 && error.status < 500) &&
          // Exclude auth/quota errors which we DO want to retry with the next key
          !(error.status === 401 || error.status === 403 || error.status === 429);

        if (isClientError) {
          // For client-side errors (e.g., invalid argument), re-throw immediately
          console.error(`Gemini API key ${i + 1} failed with non-retryable client error:`, error);
          throw error;
        } else {
          // For server-side errors (5xx), network errors, or auth/quota errors, try the next key
          lastError = error;
          console.warn(`Gemini API key ${i + 1} failed with a potentially transient error (status: ${error.status}). Trying next key...`);
          continue; // Try the next key
        }
      }
    }

    // If we've exhausted all keys, throw the last error we encountered
    throw lastError || new Error("All Gemini API keys failed.");
  }

  /**
   * Generate streaming content using Google GenAI, with intelligent key rotation.
   * @param params The parameters for content generation
   * @returns A Promise that resolves to the generated content stream response
   */
  async generateContentStream(params: GenerateContentParameters): Promise<GenerateContentStreamResponse> {
    // Try each client in sequence until one succeeds or all fail
    let lastError: any = null;

    for (let i = 0; i < this.clients.length; i++) {
      try {
        // Attempt to generate content with the current client
        const response = await this.clients[i].models.generateContentStream(params);
        return response;
      } catch (error: any) {
        // Check if the error is a client-side error (like 400 Bad Request)
        // that won't be solved by retrying with a different key.
        const isClientError =
          (error.status && error.status >= 400 && error.status < 500) &&
          // Exclude auth/quota errors which we DO want to retry with the next key
          !(error.status === 401 || error.status === 403 || error.status === 429);

        if (isClientError) {
          // For client-side errors (e.g., invalid argument), re-throw immediately
          console.error(`Gemini API key ${i + 1} failed with non-retryable client error:`, error);
          throw error;
        } else {
          // For server-side errors (5xx), network errors, or auth/quota errors, try the next key
          lastError = error;
          console.warn(`Gemini API key ${i + 1} failed with a potentially transient error (status: ${error.status}). Trying next key...`);
          continue; // Try the next key
        }
      }
    }

    // If we've exhausted all keys, throw the last error we encountered
    throw lastError || new Error("All Gemini API keys failed.");
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
            // Check if the error is a client-side error (like 400 Bad Request)
            // that won't be solved by retrying with a different key.
            const isClientError =
              (error.status && error.status >= 400 && error.status < 500) &&
              // Exclude auth/quota errors which we DO want to retry with the next key
              !(error.status === 401 || error.status === 403 || error.status === 429);

            if (isClientError) {
              // For client-side errors (e.g., invalid argument), re-throw immediately
              console.error(`Gemini API key ${i + 1} failed with non-retryable client error:`, error);
              throw error;
            } else {
              // For server-side errors (5xx), network errors, or auth/quota errors, try the next key
              lastError = error;
              console.warn(`Gemini API key ${i + 1} failed with a potentially transient error (status: ${error.status}). Trying next key...`);
              continue; // Try the next key
            }
          }
        }

        // If we've exhausted all keys, throw the last error we encountered
        throw lastError || new Error("All Gemini API keys failed.");
      },

      /**
       * Generate streaming content using Google GenAI, with intelligent key rotation.
       * @param params The parameters for content generation
       * @returns A Promise that resolves to the generated content stream response
       */
      generateContentStream: async (params: GenerateContentParameters): Promise<GenerateContentStreamResponse> => {
        // Try each client in sequence until one succeeds or all fail
        let lastError: any = null;

        for (let i = 0; i < this.clients.length; i++) {
          try {
            // Attempt to generate content with the current client
            const response = await this.clients[i].models.generateContentStream(params);
            return response;
          } catch (error: any) {
            // Check if the error is a client-side error (like 400 Bad Request)
            // that won't be solved by retrying with a different key.
            const isClientError =
              (error.status && error.status >= 400 && error.status < 500) &&
              // Exclude auth/quota errors which we DO want to retry with the next key
              !(error.status === 401 || error.status === 403 || error.status === 429);

            if (isClientError) {
              // For client-side errors (e.g., invalid argument), re-throw immediately
              console.error(`Gemini API key ${i + 1} failed with non-retryable client error:`, error);
              throw error;
            } else {
              // For server-side errors (5xx), network errors, or auth/quota errors, try the next key
              lastError = error;
              console.warn(`Gemini API key ${i + 1} failed with a potentially transient error (status: ${error.status}). Trying next key...`);
              continue; // Try the next key
            }
          }
        }

        // If we've exhausted all keys, throw the last error we encountered
        throw lastError || new Error("All Gemini API keys failed.");
      }
    };
  }
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
 GenerateContentResponse,
 GenerateContentStreamResponse,
 AIError
} from "./types/ai";

// Import Part from types/ai
import { Part } from "./types/ai";

/**
 * Type definitions for OpenAI API response
 */
interface OpenAIChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatCompletionChoice {
  index: number;
  message: OpenAIChatCompletionMessage;
  finish_reason: string;
}

interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIConfig {
  apiKey: string | string[];
  baseUrl?: string;
  modelName?: string;
}

/**
 * Google GenAI compatible parameters
 */
export interface GenerateContentParameters {
  model: string;
  contents: any;
  config?: any;
}

/**
 * Models module that implements the generateContent method
 */
class ModelsModule {
  private apiKeys: string[];
  private currentKeyIndex: number;
  private baseUrl: string;
  private modelName: string;

  constructor(apiKey: string | string[], baseUrl: string, modelName: string) {
    // 如果apiKey是字符串，则转换为数组
    this.apiKeys = Array.isArray(apiKey) ? apiKey : [apiKey];
    // 初始化当前密钥索引
    this.currentKeyIndex = 0;
    this.baseUrl = baseUrl;
    this.modelName = modelName;
  }

  /**
   * Generate content using OpenAI-compatible API, compatible with Google GenAI SDK
   * This method implements intelligent key rotation: if an API call fails due to
   * authentication or quota issues (401, 403, 429), it will automatically try the next
   * available API key until all keys are exhausted.
   */
  async generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    // Convert Google GenAI parameters to OpenAI format
    const openAIRequest: any = {
      messages: this.convertContentsToMessages(params.contents),
      temperature: (params as any).generationConfig?.temperature,
    };

    // Add system instruction if provided
    if ((params as any).systemInstruction) {
      openAIRequest.messages.unshift({
        role: 'system',
        content: (params as any).systemInstruction.parts.map((part: Part) => part.text || '').join('')
      });
    }

    // Handle JSON response format
    if ((params as any).generationConfig?.responseMimeType === "application/json") {
      openAIRequest.response_format = { type: "json_object" };
    }

    // Use the model specified in params, or fall back to the default model
    const modelToUse = params.model || this.modelName;

    // Try each API key in sequence until one succeeds or all fail
    let lastError: any = null;
    
    for (let i = 0; i < this.apiKeys.length; i++) {
      const currentApiKey = this.apiKeys[i];
      
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            ...openAIRequest,
          }),
        });

        if (!response.ok) {
          // If the error is related to authentication or quota, try the next key
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            lastError = new Error(`OpenAI API error with key ${i + 1}: ${response.status} ${response.statusText}`);
            console.warn(`API key ${i + 1} failed with status ${response.status}. Trying next key...`);
            continue; // Try the next key
          } else {
            // For other errors (e.g., 5xx server errors), re-throw immediately
            const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`) as AIError;
            error.status = response.status;
            if (response.status >= 500) {
              error.code = 'server';
            }
            throw error;
          }
        }

        const openAIResponse: OpenAIChatCompletionResponse = await response.json();
        
        // Convert OpenAI response to Google GenAI format
        return this.convertOpenAIResponseToGoogleGenAI(openAIResponse);
      } catch (error) {
        // If it's a network error or other unexpected error, try the next key
        // We'll re-throw the last error if all keys fail
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`API key ${i + 1} failed with error: ${errorMessage}. Trying next key...`);
        continue; // Try the next key
      }
    }
    
    // If we've exhausted all keys, throw the last error we encountered
    throw lastError || new Error("All API keys failed.");
  }

  /**
   * Generate streaming content using OpenAI-compatible API
   * This method implements intelligent key rotation and streaming response handling
   */
  async generateContentStream(params: GenerateContentParameters): Promise<GenerateContentStreamResponse> {
    // Convert Google GenAI parameters to OpenAI format
    const openAIRequest: any = {
      messages: this.convertContentsToMessages(params.contents),
      temperature: (params as any).generationConfig?.temperature,
      stream: true, // Enable streaming
    };

    // Add system instruction if provided
    if ((params as any).systemInstruction) {
      openAIRequest.messages.unshift({
        role: 'system',
        content: (params as any).systemInstruction.parts.map((part: Part) => part.text || '').join('')
      });
    }

    // Handle JSON response format
    if ((params as any).generationConfig?.responseMimeType === "application/json") {
      openAIRequest.response_format = { type: "json_object" };
    }

    // Use the model specified in params, or fall back to the default model
    const modelToUse = params.model || this.modelName;

    // Try each API key in sequence until one succeeds or all fail
    let lastError: any = null;
    
    for (let i = 0; i < this.apiKeys.length; i++) {
      const currentApiKey = this.apiKeys[i];
      
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            ...openAIRequest,
          }),
        });

        if (!response.ok) {
          // If the error is related to authentication or quota, try the next key
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            lastError = new Error(`OpenAI API error with key ${i + 1}: ${response.status} ${response.statusText}`);
            console.warn(`API key ${i + 1} failed with status ${response.status}. Trying next key...`);
            continue; // Try the next key
          } else {
            // For other errors (e.g., 5xx server errors), re-throw immediately
            const error = new Error(`OpenAI API error: ${response.status} ${response.statusText}`) as AIError;
            error.status = response.status;
            if (response.status >= 500) {
              error.code = 'server';
            }
            throw error;
          }
        }

        // Get the ReadableStream from the response body
        const stream = response.body;
        if (!stream) {
          throw new Error('Response body is null');
        }

        // Log the response headers for debugging
        console.log('OpenAI API Response Headers:', Object.fromEntries(response.headers.entries()));

        // Check if the response is actually a stream
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/event-stream')) {
            console.warn('OpenAI API response is not a stream. Content-Type:', contentType);
            // Try to read the response body and log it for debugging
            const responseBody = await response.clone().text();
            console.warn('OpenAI API response body:', responseBody);
        }

        // Create an async iterator for the streaming response
        const streamIterator: GenerateContentStreamResponse = {
          [Symbol.asyncIterator]() {
            let reader: ReadableStreamDefaultReader<Uint8Array> | null = stream.getReader();
            let decoder = new TextDecoder();
            let buffer = ''; // Buffer to accumulate incomplete lines

            return {
              async next() {
                try {
                  while (true) {
                    // Read a chunk from the stream
                    const { done, value } = await reader!.read();
                    
                    if (done) {
                      // Stream has ended
                      reader!.releaseLock();
                      reader = null;
                      return { done: true, value: null };
                    }

                    // Decode the chunk and add it to the buffer
                    buffer += decoder.decode(value, { stream: true });

                    // Split the buffer by newlines to process complete lines
                    const lines = buffer.split('\n');
                    
                    // The last element might be incomplete, so keep it in the buffer
                    buffer = lines.pop() || '';

                    // Process each complete line
                    for (const line of lines) {
                      const trimmedLine = line.trim();
                      
                      // Skip empty lines and comments
                      if (!trimmedLine || trimmedLine.startsWith(':')) {
                        continue;
                      }

                      // Check if it's a data line
                      if (trimmedLine.startsWith('data:')) {
                        const dataStr = trimmedLine.substring(5).trim(); // Remove 'data:' prefix
                        
                        // Check for stream end signal
                        if (dataStr === '[DONE]') {
                          if (reader) {
                            reader.releaseLock();
                            reader = null;
                          }
                          return { done: true, value: null };
                        }

                        try {
                          // Parse the JSON data
                          const data = JSON.parse(dataStr);
                          
                          // Extract the delta content
                          const deltaContent = data.choices?.[0]?.delta?.content || '';
                          
                          // If deltaContent is empty, continue to the next line
                          if (!deltaContent) {
                              continue;
                          }
                          
                          // Create a chunk object that conforms to GenerateContentResponse
                          const chunk: GenerateContentResponse = {
                            text: () => deltaContent,
                            candidates: [
                              {
                                content: {
                                  parts: [
                                    {
                                      text: deltaContent
                                    }
                                  ],
                                  role: 'model' // Assuming the role is 'model' for generated content
                                }
                              }
                            ]
                          };

                          // Return the chunk
                          return { done: false, value: chunk };
                        } catch (parseError) {
                          console.error('Error parsing SSE data:', dataStr, parseError);
                          // Continue to the next line if parsing fails
                        }
                      }
                      // Handle other SSE event types (e.g., 'event:', 'id:') if needed
                      // For now, we'll ignore them
                    }
                  }
                } catch (streamError) {
                  // Handle any errors that occur during streaming
                  if (reader) {
                    reader.releaseLock();
                    reader = null;
                  }
                  console.error('Error reading stream:', streamError);
                  throw streamError;
                }
              },
              
              // Implement the return method to clean up resources
              async return() {
                if (reader) {
                  reader.releaseLock();
                  reader = null;
                }
                return { done: true, value: undefined };
              },
              
              // Implement the throw method to handle errors
              async throw(error: any) {
                if (reader) {
                  reader.releaseLock();
                  reader = null;
                }
                throw error;
              }
            };
          }
        };

        return streamIterator;
      } catch (error) {
        // If it's a network error or other unexpected error, try the next key
        // We'll re-throw the last error if all keys fail
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`API key ${i + 1} failed with error: ${errorMessage}. Trying next key...`);
        continue; // Try the next key
      }
    }
    
    // If we've exhausted all keys, throw the last error we encountered
    throw lastError || new Error("All API keys failed.");
  }

  private convertContentsToMessages(contents: any): any[] {
    if (typeof contents === 'string') {
      return [{ role: 'user', content: contents }];
    }

    if (Array.isArray(contents)) {
      // Handle array of parts
      const textParts = contents.filter((part: any) => part.text).map((part: any) => part.text).join('');
      return [{ role: 'user', content: textParts }];
    }

    // Handle ContentListUnion
    if (contents.parts) {
      const textParts = contents.parts.filter((part: any) => part.text).map((part: any) => part.text).join('');
      return [{ role: 'user', content: textParts }];
    }

    // Handle single part
    if (contents.text) {
      return [{ role: 'user', content: contents.text }];
    }

    return [{ role: 'user', content: JSON.stringify(contents) }];
  }

  private convertOpenAIResponseToGoogleGenAI(openAIResponse: OpenAIChatCompletionResponse): any {
    const choice = openAIResponse.choices[0];
    if (!choice) {
      throw new Error('No response choices returned from OpenAI API');
    }

    // Create a Google GenAI compatible response object
    const response: any = {
      text: () => choice.message.content || '',
      candidates: [
        {
          content: {
            parts: [
              {
                text: choice.message.content || ''
              }
            ],
            role: choice.message.role
          }
        }
      ],
      // Add getter methods for other properties
      get data() { return undefined; },
      get functionCalls() { return undefined; },
      get executableCode() { return undefined; },
      get codeExecutionResult() { return undefined; }
    };

    return response;
  }
}

/**
 * A minimal OpenAI-compatible API client with Google GenAI SDK compatibility
 * This class implements the same interface as GoogleGenAI to act as an adapter
 */
export class OpenAIAPI {
  public models: ModelsModule;
  // Add dummy properties to match GoogleGenAI interface
  public apiClient: any = null;
  public vertexai: boolean = false;
  public live: any = null;
  public batches: any = null;
  public chats: any = null;
  public caches: any = null;
  public files: any = null;
  public operations: any = null;
  public authTokens: any = null;
  public tunings: any = null;

  constructor(config: OpenAIConfig) {
    const apiKey = config.apiKey;
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const modelName = config.modelName || 'gpt-4-turbo';
    
    this.models = new ModelsModule(apiKey, baseUrl, modelName);
  }

  /**
   * Generate content using OpenAI-compatible API with streaming support
   * This method implements intelligent key rotation and streaming response handling
   */
  async generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    return this.models.generateContent(params);
  }

  /**
   * Generate streaming content using OpenAI-compatible API
   * This method implements intelligent key rotation and streaming response handling
   */
  async generateContentStream(params: GenerateContentParameters): Promise<GenerateContentStreamResponse> {
    return this.models.generateContentStream(params);
  }
}
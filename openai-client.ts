/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
   * 获取下一个API密钥（轮询机制）
   */
  private getNextApiKey(): string {
    const key = this.apiKeys[this.currentKeyIndex];
    // 更新索引以实现轮询
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * Generate content using OpenAI-compatible API, compatible with Google GenAI SDK
   */
  async generateContent(params: GenerateContentParameters): Promise<any> {
    // Convert Google GenAI parameters to OpenAI format
    const openAIRequest: any = {
      messages: this.convertContentsToMessages(params.contents),
      temperature: params.config?.temperature,
    };

    // Add system instruction if provided
    if (params.config?.systemInstruction) {
      openAIRequest.messages.unshift({
        role: 'system',
        content: typeof params.config.systemInstruction === 'string'
          ? params.config.systemInstruction
          : params.config.systemInstruction.parts?.map((part: any) => part.text).join('') || ''
      });
    }

    // Handle JSON response format
    if (params.config?.responseMimeType === "application/json") {
      openAIRequest.response_format = { type: "json_object" };
    }

    // Use the model specified in params, or fall back to the default model
    const modelToUse = params.model || this.modelName;

    try {
      // 获取当前API密钥
      const currentApiKey = this.getNextApiKey();
      
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
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const openAIResponse: OpenAIChatCompletionResponse = await response.json();
      
      // Convert OpenAI response to Google GenAI format
      return this.convertOpenAIResponseToGoogleGenAI(openAIResponse);
    } catch (error) {
      throw error;
    }
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
}
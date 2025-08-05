/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Part interface for content pieces
export interface Part {
  text?: string;
  // 可根据需要扩展其他类型，如 inlineData, functionCall 等
}

// Content interface for messages
export interface Content {
  parts: Part[];
  role: 'user' | 'model'; // Google GenAI 风格，OpenAI需映射 assistant <-> model
}

// Generation configuration
export interface GenerationConfig {
  temperature?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  // 可根据需要扩展 maxOutputTokens, topP, topK 等
}

// System instruction
export interface SystemInstruction {
  parts: Part[];
}

// Standardized parameters for generateContent and generateContentStream
export interface GenerateContentParameters {
  model: string;
  contents: Content[];
  generationConfig?: GenerationConfig;
  systemInstruction?: SystemInstruction;
}

// Candidate for response
export interface Candidate {
  content: Content;
  finishReason?: string;
  // 可根据需要扩展 index, safetyRatings 等
}

// Unified response interface
export interface GenerateContentResponse {
  text: () => string;
  candidates: Candidate[];
  // 可根据需要扩展 usageMetadata, promptFeedback 等
}

// Async iterator for streaming responses
export interface GenerateContentStreamResponse extends AsyncIterable<GenerateContentResponse> {}

// Unified AI Client interface
export interface AIClient {
  models: {
    generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
    generateContentStream(params: GenerateContentParameters): Promise<GenerateContentStreamResponse>;
  };
}

// Standardized error interface
export interface AIError extends Error {
  code?: string; // 'auth', 'rate_limit', 'timeout', 'server'
  status?: number; // HTTP status code
  retryAfter?: number; // seconds to wait before retrying (for rate limit)
}

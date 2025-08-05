/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Diff from 'diff';
import JSZip from 'jszip';
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { OpenAIAPI } from "./openai-client";
import { GeminiAPI } from "./gemini-client";
import { GenerateContentParameters } from "./types/ai";
import { configManager, ApiKeyConfig } from './config';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import {
    defaultCustomPromptsWebsite,
    defaultCustomPromptsCreative,
    createDefaultCustomPromptsMath,
    createDefaultCustomPromptsAgent,
    defaultCustomPromptsReact,
    systemInstructionHtmlOutputOnly,
    systemInstructionJsonOutputOnly,
    systemInstructionTextOutputOnly
} from './prompts.js';

// Constants for retry logic
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;
const BACKOFF_FACTOR = 2;

// 流式读取配置常量
const STREAM_CONFIG = {
  FIRST_BYTE_TIMEOUT: 60000,
  CHUNK_SILENCE_TIMEOUT: 120000,
  TOTAL_TIMEOUT: 600000,
} as const;

// 流式读取回调类型
type StreamChunkCallback = (chunk: string) => void;
type StreamCompleteCallback = (fullText: string) => void;
type StreamErrorCallback = (error: Error) => void;

class PipelineStopRequestedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PipelineStopRequestedError";
    }
}

type ApplicationMode = 'website' | 'creative' | 'math' | 'agent' | 'react';
type AIProvider = 'gemini' | 'openai';

interface ApiClientPoolManager {
  clients: (GoogleGenAI | OpenAIAPI | GeminiAPI)[];
  currentIndex: number;
  getNextClient(): GoogleGenAI | OpenAIAPI | GeminiAPI;
}

interface AgentGeneratedPrompts {
    iteration_type_description: string;
    expected_output_content_type: string;
    placeholders_guide: Record<string, string>;
    initial_generation: { system_instruction: string; user_prompt_template: string; };
    feature_implementation: { system_instruction: string; user_prompt_template: string; };
    refinement_and_suggestion: { system_instruction: string; user_prompt_template: string; };
    final_polish: { system_instruction: string; user_prompt_template: string; };
}

interface IterationData {
    iterationNumber: number;
    title: string;
    requestPromptHtml_InitialGenerate?: string;
    requestPromptHtml_FeatureImplement?: string;
    requestPromptHtml_BugFix?: string;
    requestPromptFeatures_Suggest?: string;
    generatedHtml?: string;
    suggestedFeatures?: string[];
    requestPromptText_GenerateDraft?: string;
    requestPromptText_Critique?: string;
    requestPromptText_Revise?: string;
    requestPromptText_Polish?: string;
    generatedOrRevisedText?: string;
    critiqueSuggestions?: string[];
    agentJudgeLLM_InitialRequest?: string;
    agentGeneratedPrompts?: AgentGeneratedPrompts;
    requestPrompt_SysInstruction?: string;
    requestPrompt_UserTemplate?: string;
    requestPrompt_Rendered?: string;
    generatedMainContent?: string;
    requestPrompt_SubStep_SysInstruction?: string;
    requestPrompt_SubStep_UserTemplate?: string;
    requestPrompt_SubStep_Rendered?: string;
    generatedSubStep_Content?: string;
    generatedSuggestions?: string[];
    status: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    error?: string;
    isDetailsOpen?: boolean;
    retryAttempt?: number;
}

interface PipelineState {
    id: number;
    originalTemperatureIndex: number;
    temperature: number;
    modelName: string;
    iterations: IterationData[];
    status: 'idle' | 'processing' | 'completed' | 'failed' | 'stopped';
    isStopRequested: boolean;
    tabButtonElement?: HTMLButtonElement;
    contentElement?: HTMLDivElement;
    stopButtonElement?: HTMLButtonElement;
}

interface MathHypothesisData {
    id: string;
    hypothesisText: string;
    finalStatus: 'proven' | 'refuted' | 'unresolved' | 'contradiction';
    proverAttempt?: string;
    disproverAttempt?: string;
    judgingStatus: 'pending' | 'processing' | 'completed' | 'error' | 'retrying';
    judgingError?: string;
    judgingResponseText?: string;
}

interface MathMainStrategyData {
    id: string;
    strategyText: string;
    solutionText?: string;
    judgingStatus: 'pending' | 'processing' | 'completed' | 'error' | 'retrying';
    judgingError?: string;
    judgingResponseText?: string;
}

interface MathPipelineState {
    id: string;
    problemText: string;
    problemImageBase64?: string;
    problemImageMimeType?: string;
    status: 'idle' | 'processing' | 'completed' | 'failed' | 'stopped' | 'retrying';
    isStopRequested: boolean;
    retryAttempt?: number;
    error?: string;
    requestPromptInitialStrategyGen?: string;
    initialStrategies: MathMainStrategyData[];
    hypothesisExplorerComplete: boolean;
    hypothesisData: MathHypothesisData[];
    finalJudgingStatus: 'pending' | 'processing' | 'completed' | 'error' | 'retrying';
    finalJudgingError?: string;
    finalJudgingResponseText?: string;
    finalJudgingRequestPrompt?: string;
    finalJudgedBestStrategyId?: string;
    finalJudgedBestSolution?: string;
    activeTabId?: string;
}

interface ReactPipelineStage {
    id: number;
    title: string;
    systemInstruction?: string;
    userPrompt?: string;
    renderedUserPrompt?: string;
    generatedContent?: string;
    status: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    error?: string;
    retryAttempt?: number;
}

interface ReactPipelineState {
    id: string;
    userRequest: string;
    status: 'idle' | 'orchestrating' | 'processing_workers' | 'completed' | 'failed' | 'stopped' | 'stopping';
    isStopRequested: boolean;
    error?: string;
    orchestratorPlan?: string;
    orchestratorRequestPrompt?: string;
    orchestratorResponseText?: string;
    stages: ReactPipelineStage[];
    finalAppendedCode?: string;
    activeTabId?: string;
}

interface ExportedConfig {
    currentMode: ApplicationMode;
    initialIdea: string;
    problemImageBase64?: string;
    problemImageMimeType?: string;
    selectedModel: string;
    selectedOriginalTemperatureIndices: number[];
    pipelinesState: Omit<PipelineState, 'tabButtonElement' | 'contentElement' | 'stopButtonElement'>[];
    activeMathPipeline: MathPipelineState | null;
    activeReactPipeline: ReactPipelineState | null;
    activePipelineId: number | null;
    activeMathProblemTabId?: string;
    globalStatusText: string;
    globalStatusClass: string;
    customPromptsWebsite: typeof defaultCustomPromptsWebsite;
    customPromptsCreative: typeof defaultCustomPromptsCreative;
    customPromptsMath: ReturnType<typeof createDefaultCustomPromptsMath>;
    customPromptsAgent: ReturnType<typeof createDefaultCustomPromptsAgent>;
    customPromptsReact: typeof defaultCustomPromptsReact;
    isCustomPromptsOpen: boolean;
}

// DOM Elements
let initialIdeaInput: HTMLInputElement;
let generateButton: HTMLButtonElement;
let stopPipelineButton: HTMLButtonElement;
let appModeSelector: HTMLDivElement;
let tabsNavContainer: HTMLDivElement;
let pipelinesContentContainer: HTMLDivElement;
let pipelineSelectorsContainer: HTMLDivElement;
let globalStatusText: HTMLSpanElement;
let globalStatusIndicator: HTMLSpanElement;
let mathProblemImageInput: HTMLInputElement;
let mathProblemImagePreview: HTMLImageElement;
let exportConfigButton: HTMLButtonElement;
let importConfigInput: HTMLInputElement;
let customizePromptsTrigger: HTMLButtonElement;
let promptsModalOverlay: HTMLDivElement;
let promptsModalCloseButton: HTMLButtonElement;
let diffModalOverlay: HTMLDivElement;
let diffModalCloseButton: HTMLButtonElement;
let diffSourceLabel: HTMLSpanElement;
let diffTargetTreeContainer: HTMLDivElement;
let diffViewerPanel: HTMLDivElement;
let modelSelectElement: HTMLSelectElement;
let aiProviderSelector: HTMLSelectElement;
let apiKeyInput: HTMLInputElement;
let saveApiKeyButton: HTMLButtonElement;
let clearApiKeyButton: HTMLButtonElement;
let openaiBaseUrlInput: HTMLInputElement;
let openaiModelNameInput: HTMLInputElement;

// State variables
let currentMode: ApplicationMode = 'website';
let pipelinesState: PipelineState[] = [];
let activePipelineId: number = 0;
let activeMathPipeline: MathPipelineState | null = null;
let activeReactPipeline: ReactPipelineState | null = null;
let isGenerating = false;
let aiPoolManager: ApiClientPoolManager | null = null;
let currentProblemImageBase64: string | null = null;
let currentProblemImageMimeType: string | null = null;

// Custom Prompts State
let customPromptsWebsiteState = defaultCustomPromptsWebsite;
let customPromptsCreativeState = defaultCustomPromptsCreative;
let customPromptsMathState = createDefaultCustomPromptsMath(3, 3);
let customPromptsAgentState = createDefaultCustomPromptsAgent(3);
let customPromptsReactState = defaultCustomPromptsReact;
let isCustomPromptsOpen = false;

// Log config for debugging
// Log config for debugging
console.log('Initial Config Loaded:', configManager);
// Math Mode Constants
const MATH_FIXED_TEMPERATURE = 0.7;
const MATH_MODEL_NAME = "gemini-2.5-pro";

// 安全调用模型函数，带超时和重试机制
async function safeModelCall(
    promptOrParts: string | Part[],
    temperature: number,
    modelName: string,
    systemInstruction?: string,
    isJson?: boolean,
    timeoutMs: number = 30000,
    maxRetries: number = MAX_RETRIES,
    backoffFactor: number = BACKOFF_FACTOR
): Promise<GenerateContentResponse> {
    const client = aiPoolManager?.getNextClient();
    if (!client) throw new Error("No API client available");

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (Date.now() - startTime > timeoutMs) {
            throw new Error(`Operation timed out after ${timeoutMs}ms`);
        }

        try {
            const parts = typeof promptOrParts === 'string' ? [{ text: promptOrParts }] : promptOrParts;
            const config: GenerateContentParameters = {
                contents: [{ parts, role: 'user' }],
                generationConfig: {
                    temperature,
                    responseMimeType: isJson ? 'application/json' : 'text/plain',
                },
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                model: modelName,
            };

            let response: any;
            if (client instanceof GoogleGenAI) {
                // For GoogleGenAI, we need to pass the model name in the config object
                // to override the default model set in the client.
                response = await client.models.generateContent({
                    ...config,
                    model: modelName, // Use the model name from the function parameter
                });
            } else if (client instanceof OpenAIAPI) {
                // For OpenAIAPI, the model name is already included in the config object
                response = await client.models.generateContent(config);
            } else if (client instanceof GeminiAPI) {
                // For GeminiAPI, the model name is already included in the config object
                response = await client.models.generateContent(config);
            } else {
                throw new Error("Unsupported client type");
            }

            return response;
        } catch (error: any) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = INITIAL_DELAY_MS * Math.pow(backoffFactor, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error("All retry attempts failed");
}

// 统一流式读取工具函数
async function streamModelCall(
    promptOrParts: string | Part[],
    temperature: number,
    modelName: string,
    systemInstruction?: string,
    isJson?: boolean,
    onChunk?: StreamChunkCallback,
    onComplete?: StreamCompleteCallback,
    onError?: StreamErrorCallback
): Promise<string> {
    // Check if the required configuration is set
    const { isValid, message } = configManager.checkRequiredConfig();
    if (!isValid) {
        const error = new Error(message);
        onError?.(error);
        onComplete?.('');
        throw error;
    }

    const client = aiPoolManager?.getNextClient();
    if (!client) {
        const error = new Error("No API client available");
        onError?.(error);
        onComplete?.('');
        throw error;
    }

    const parts = typeof promptOrParts === 'string' ? [{ text: promptOrParts }] : promptOrParts;
    const config: GenerateContentParameters = {
        contents: [{ parts, role: 'user' }],
        generationConfig: {
            temperature,
            responseMimeType: isJson ? 'application/json' : 'text/plain',
        },
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        model: modelName,
    };

    let fullText = '';
    let firstByteReceived = false;
    let lastChunkTime = Date.now();
    let startTime = Date.now();

    const checkTimeouts = () => {
        const now = Date.now();
        if (!firstByteReceived && now - startTime > STREAM_CONFIG.FIRST_BYTE_TIMEOUT) {
            throw new Error(`First byte timeout after ${STREAM_CONFIG.FIRST_BYTE_TIMEOUT}ms`);
        }
        if (firstByteReceived && now - lastChunkTime > STREAM_CONFIG.CHUNK_SILENCE_TIMEOUT) {
            throw new Error(`Chunk silence timeout after ${STREAM_CONFIG.CHUNK_SILENCE_TIMEOUT}ms`);
        }
        if (now - startTime > STREAM_CONFIG.TOTAL_TIMEOUT) {
            throw new Error(`Total timeout after ${STREAM_CONFIG.TOTAL_TIMEOUT}ms`);
        }
    };

    try {
        if (client instanceof GoogleGenAI) {
            const response = await client.models.generateContentStream({
                ...config,
                model: modelName, // Use the model name from the function parameter
            });

            for await (const chunk of response) {
                checkTimeouts();
                firstByteReceived = true;
                lastChunkTime = Date.now();

                const text = typeof (chunk as any).text === 'function' ? (chunk as any).text() : (typeof (chunk as any).text === 'string' ? (chunk as any).text : '');
                fullText += text;
                onChunk?.(text);
            }
        } else if (client instanceof OpenAIAPI) {
            const response = await client.models.generateContentStream(config);

            for await (const chunk of response) {
                checkTimeouts();
                firstByteReceived = true;
                lastChunkTime = Date.now();

                const text = typeof (chunk as any).text === 'function' ? (chunk as any).text() : (typeof (chunk as any).text === 'string' ? (chunk as any).text : '');
                fullText += text;
                onChunk?.(text);
            }
        } else if (client instanceof GeminiAPI) {
            // For GeminiAPI, we need to adjust the config to match the expected format
            const geminiConfig: GenerateContentParameters = {
                ...config,
                contents: config.contents.map(content => ({
                    ...content,
                    role: content.role === 'user' ? 'user' : 'model' // Adjust role if needed
                }))
            };
            
            const response = await client.generateContentStream(geminiConfig);

            for await (const chunk of response) {
                checkTimeouts();
                firstByteReceived = true;
                lastChunkTime = Date.now();

                const text = typeof (chunk as any).text === 'function' ? (chunk as any).text() : (typeof (chunk as any).text === 'string' ? (chunk as any).text : '');
                fullText += text;
                onChunk?.(text);
            }
        } else {
            throw new Error("Unsupported client type");
        }

        onComplete?.(fullText);
        return fullText;
    } catch (error: any) {
        console.warn("Stream failed, attempting fallback to non-streaming call:", error);
        // Attempt fallback to non-streaming call
        try {
            const fallbackResponse = await safeModelCall(
                promptOrParts,
                temperature,
                modelName,
                systemInstruction,
                isJson
            );
            const fallbackText = typeof (fallbackResponse as any).text === 'function' ? (fallbackResponse as any).text() : (typeof (fallbackResponse as any).text === 'string' ? (fallbackResponse as any).text : '');
            onComplete?.(fallbackText);
            return fallbackText;
        } catch (fallbackError: any) {
            console.error("Fallback non-streaming call also failed:", fallbackError);
            onError?.(error); // Use the original stream error for the callback
            // Ensure onComplete is called even if an error occurs
            onComplete?.(fullText);
            throw error; // Re-throw the original stream error
        }
    }
}

// JudgingAggregator类，用于流式收集和部分结果处理
class JudgingAggregator {
    private results: Array<{ id: string; result: any; status: 'pending' | 'completed' | 'error' }> = [];
    private softMinSamples: number;
    private windowTimeoutMs: number;
    private overallTimeoutMs: number;
    private startTime: number;
    private timeoutId: NodeJS.Timeout | null = null;
    private onPartialResult: (results: any[], isFinal: boolean) => void;
    private onComplete: (results: any[]) => void;
    private onError: (error: Error) => void;

    constructor(
        softMinSamples: number = 3,
        windowTimeoutMs: number = 10000,
        overallTimeoutMs: number = 60000,
        onPartialResult: (results: any[], isFinal: boolean) => void,
        onComplete: (results: any[]) => void,
        onError: (error: Error) => void
    ) {
        this.softMinSamples = softMinSamples;
        this.windowTimeoutMs = windowTimeoutMs;
        this.overallTimeoutMs = overallTimeoutMs;
        this.startTime = Date.now();
        this.onPartialResult = onPartialResult;
        this.onComplete = onComplete;
        this.onError = onError;
    }

    // 添加一个结果
    addResult(id: string, result: any, status: 'completed' | 'error' = 'completed') {
        // 查找是否已存在该ID的结果
        const existingIndex = this.results.findIndex(r => r.id === id);
        if (existingIndex >= 0) {
            // 更新现有结果
            this.results[existingIndex] = { id, result, status };
        } else {
            // 添加新结果
            this.results.push({ id, result, status });
        }

        // 检查是否达到软最小样本数
        const completedResults = this.results.filter(r => r.status === 'completed');
        if (completedResults.length >= this.softMinSamples) {
            // 如果达到软最小样本数，触发部分结果回调
            this.onPartialResult(completedResults, false);
        }
    }

    // Placeholder for actual implementation
    // This should be replaced with a call to safeModelCall or streamModelCall
    // or a direct API call with proper error handling and retry logic
    private async callModel(prompt: string, temperature: number, modelName: string, systemInstruction?: string, isJson?: boolean): Promise<any> {
        // This is a placeholder implementation
        // It should be replaced with a call to safeModelCall or streamModelCall
        // or a direct API call with proper error handling and retry logic
        throw new Error("Not implemented");
    }
}


// Helper function to clean output based on expected type
function cleanOutputByType(output: string, expectedType: string): string {
    if (typeof output !== 'string') return '';

    let cleaned = output.trim();

    // Handle different expected output types
    switch (expectedType.toLowerCase()) {
        case 'html':
            // Remove any markdown code block markers
            cleaned = cleaned.replace(/^```(?:html)?/i, '').replace(/```$/, '').trim();
            // Basic validation: check if it looks like HTML
            if (!cleaned.includes('<') || !cleaned.includes('>')) {
                console.warn("Output was expected to be HTML but doesn't look like it. Returning as-is.");
            }
            break;
        case 'json':
            // Remove any markdown code block markers
            cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
            // Basic validation: check if it looks like JSON
            if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
                console.warn("Output was expected to be JSON but doesn't look like it. Returning as-is.");
            }
            break;
        case 'markdown':
            // Remove any markdown code block markers if they wrap the entire content
            cleaned = cleaned.replace(/^```(?:markdown)?/i, '').replace(/```$/, '').trim();
            break;
        case 'text':
        default:
            // For plain text, just remove any wrapping code block markers
            cleaned = cleaned.replace(/^```(?:text)?/i, '').replace(/```$/, '').trim();
            break;
    }

    return cleaned;
}

// Helper function to parse JSON suggestions
function parseJsonSuggestions(jsonString: string, arrayKey: 'features' | 'suggestions' | 'strategies' | 'sub_strategies', minCount: number = 1): string[] {
    try {
        const cleanedJson = cleanOutputByType(jsonString, 'json');
        const parsed = JSON.parse(cleanedJson);
        
        // Check if the specified key exists and is an array
        if (Array.isArray(parsed[arrayKey])) {
            const suggestions = parsed[arrayKey].filter((item: any) => typeof item === 'string');
            if (suggestions.length >= minCount) {
                return suggestions.slice(0, 5); // Limit to 5 suggestions
            }
        }
        
        // If the primary key doesn't work, try to find any array of strings
        for (const key in parsed) {
            if (Array.isArray(parsed[key])) {
                const suggestions = parsed[key].filter((item: any) => typeof item === 'string');
                if (suggestions.length >= minCount) {
                    return suggestions.slice(0, 5);
                }
            }
        }
        
        console.warn(`JSON parsing: No valid array of strings found for key '${arrayKey}' or any other key.`);
        return [];
    } catch (e) {
        console.error("Error parsing JSON suggestions:", e);
        return [];
    }
}

// --- API Key Management ---

function saveApiKey(provider: 'gemini' | 'openai', config: ApiKeyConfig) {
    const storageKey = `${provider}_apiKey`;
    localStorage.setItem(storageKey, JSON.stringify(config));
    configManager.updateApiKey(provider, config);
    console.log(`${provider} API key and config saved and AppConfig updated.`, config);
}

function loadAndApplyApiKey(provider: 'gemini' | 'openai') {
    console.log(`Loading and applying API key for ${provider}`);
    configManager.loadFromLocalStorage(); // Ensure config is fresh
    const keys = provider === 'gemini' ? configManager.googleGenaiApiKeys : configManager.openaiApiKeys;
    
    if (keys.length > 0) {
        const keyConfig = keys[0];
        apiKeyInput.value = keyConfig.key;
        if (provider === 'openai') {
            openaiBaseUrlInput.value = keyConfig.baseUrl || '';
            openaiModelNameInput.value = keyConfig.modelName || '';
        }
        updateApiKeyUI(provider, true);
        console.log(`Applied stored API key for ${provider}.`);
        return keyConfig;
    }
    
    console.log(`No stored API key found for ${provider}.`);
    updateApiKeyUI(provider, false);
    return null;
}

function clearApiKey(provider: 'gemini' | 'openai') {
    const storageKey = `${provider}_apiKey`;
    localStorage.removeItem(storageKey);
    configManager.updateApiKey(provider, null);
    apiKeyInput.value = '';
    if (provider === 'openai') {
        openaiBaseUrlInput.value = '';
        openaiModelNameInput.value = '';
    }
    updateApiKeyUI(provider, false);
    console.log(`${provider} API key and config cleared.`);
}

function updateApiKeyUI(provider: AIProvider, isKeySet: boolean) {
    const statusElement = document.getElementById('api-key-status');
    if (statusElement) {
        if (isKeySet) {
            statusElement.textContent = `${provider.toUpperCase()} Key Set`;
            statusElement.classList.remove('status-badge-error');
            statusElement.classList.add('status-badge-success');
        } else {
            statusElement.textContent = `No ${provider.toUpperCase()} Key`;
            statusElement.classList.remove('status-badge-success');
            statusElement.classList.add('status-badge-error');
        }
    }
}

function initializeApiPoolManager() {
    if (aiPoolManager) {
        console.log("API Pool Manager already initialized.");
        return;
    }
    console.log("Initializing API Pool Manager...");
    const clients: (GoogleGenAI | OpenAIAPI | GeminiAPI)[] = [];
    
    // Initialize Gemini clients from configManager
    configManager.googleGenaiApiKeys.forEach(config => {
        clients.push(new GeminiAPI([config.key]));
    });

    // Initialize OpenAI clients from configManager
    configManager.openaiApiKeys.forEach(config => {
        if (config.baseUrl) {
            clients.push(new OpenAIAPI({ apiKey: config.key, baseUrl: config.baseUrl }));
        }
    });

    if (clients.length === 0) {
        console.error("No API clients could be initialized. Check your API key configuration.");
        return;
    }

    aiPoolManager = {
        clients,
        currentIndex: 0,
        getNextClient: () => {
            const client = aiPoolManager!.clients[aiPoolManager!.currentIndex];
            aiPoolManager!.currentIndex = (aiPoolManager!.currentIndex + 1) % aiPoolManager!.clients.length;
            return client;
        }
    };
    console.log("API Pool Manager initialized with", clients.length, "clients.");
}

async function runWebsitePipeline() {
    const initialIdea = initialIdeaInput.value.trim();
    if (!initialIdea) {
        alert("Please enter your request.");
        return;
    }

    const pipelineId = Date.now();
    const newPipeline: PipelineState = {
        id: pipelineId,
        originalTemperatureIndex: 0, // Simplified for now
        temperature: 0.7, // Simplified for now
        modelName: modelSelectElement.value,
        iterations: [],
        status: 'processing',
        isStopRequested: false,
    };
    pipelinesState.push(newPipeline);
    activePipelineId = pipelineId;

    renderPipelineTabs();
    renderPipelineContent(newPipeline);

    // --- Iteration 1: Initial HTML Generation ---
    const iteration1: IterationData = {
        iterationNumber: 1,
        title: "Initial HTML Generation",
        status: 'processing',
    };
    newPipeline.iterations.push(iteration1);
    renderPipelineContent(newPipeline);

    try {
        const userPrompt = customPromptsWebsiteState['initial-gen'].user.replace('{{initialIdea}}', initialIdea);
        const systemInstruction = customPromptsWebsiteState['initial-gen'].system;

        const generatedHtml = await streamModelCall(
            userPrompt,
            newPipeline.temperature,
            newPipeline.modelName,
            systemInstruction,
            false,
            (chunk) => {
                // Update UI with streaming chunks if needed
            }
        );

        iteration1.generatedHtml = cleanOutputByType(generatedHtml, 'html');
        iteration1.status = 'completed';
    } catch (error) {
        iteration1.status = 'error';
        iteration1.error = error instanceof Error ? error.message : String(error);
        console.error("Error in Iteration 1:", error);
    } finally {
        renderPipelineContent(newPipeline);
    }
}

function renderPipelineTabs() {
    tabsNavContainer.innerHTML = '';
    pipelinesState.forEach(pipeline => {
        const tabButton = document.createElement('button');
        tabButton.className = 'tab-button';
        tabButton.textContent = `Pipeline ${pipeline.id}`;
        tabButton.onclick = () => {
            activePipelineId = pipeline.id;
            renderPipelineTabs();
            const currentPipeline = pipelinesState.find(p => p.id === activePipelineId);
            if (currentPipeline) {
                renderPipelineContent(currentPipeline);
            }
        };
        if (pipeline.id === activePipelineId) {
            tabButton.classList.add('active');
        }
        tabsNavContainer.appendChild(tabButton);
    });
}

function renderPipelineContent(pipeline: PipelineState) {
    if (!pipelinesContentContainer) return;
    pipelinesContentContainer.innerHTML = ''; // Clear previous content

    const pipelineContent = document.createElement('div');
    pipelineContent.className = 'pipeline-content active';

    pipeline.iterations.forEach(iter => {
        const iterElement = document.createElement('div');
        iterElement.className = 'model-detail-card';
        let contentHtml = `<h3>${iter.title} (Status: ${iter.status})</h3>`;
        if (iter.generatedHtml) {
            contentHtml += '<h4>Generated HTML:</h4><pre><code>' + hljs.highlight('html', iter.generatedHtml).value + '</code></pre>';
        }
        if (iter.error) {
            contentHtml += `<p style="color: red;">Error: ${iter.error}</p>`;
        }
        iterElement.innerHTML = contentHtml;
        pipelineContent.appendChild(iterElement);
    });

    pipelinesContentContainer.appendChild(pipelineContent);
}
async function runMathPipeline() {
    const problemText = initialIdeaInput.value.trim();
    if (!problemText) {
        alert("Please enter a math problem.");
        return;
    }

    // Ensure Math prompts are initialized (defensive check)
    if (typeof customPromptsMathState === 'undefined') {
        console.error("Math prompts state is undefined in runMathPipeline. Initializing with default.");
        customPromptsMathState = createDefaultCustomPromptsMath(3, 3);
    }

    // Guard access to the prompt definition
    const promptDef = customPromptsMathState['math-initial-strategy'];
    if (!promptDef || typeof promptDef.user !== 'string' || typeof promptDef.system !== 'string') {
        const errorMsg = "Math prompts are not properly initialized or are missing required fields.";
        console.error(errorMsg, customPromptsMathState);
        if (activeMathPipeline) {
            activeMathPipeline.status = 'failed';
            activeMathPipeline.error = errorMsg;
        } else {
            // If activeMathPipeline is not yet set, create a temporary one for error display
            activeMathPipeline = {
                id: `math-${Date.now()}`,
                problemText,
                status: 'failed',
                isStopRequested: false,
                initialStrategies: [],
                hypothesisExplorerComplete: false,
                hypothesisData: [],
                finalJudgingStatus: 'pending',
                error: errorMsg
            };
        }
        renderMathPipelineContent();
        return;
    }

    const pipelineId = `math-${Date.now()}`;
    const newPipeline: MathPipelineState = {
        id: pipelineId,
        problemText,
        status: 'processing',
        isStopRequested: false,
        initialStrategies: [],
        hypothesisExplorerComplete: false,
        hypothesisData: [],
        finalJudgingStatus: 'pending',
    };
    activeMathPipeline = newPipeline;

    renderMathPipelineContent();

    // --- Stage 1: Initial Strategy Generation ---
    try {
        const userPrompt = promptDef.user.replace('{{originalProblemText}}', problemText);
        const systemInstruction = promptDef.system;


        const generatedStrategies = await streamModelCall(
            userPrompt,
            MATH_FIXED_TEMPERATURE,
            MATH_MODEL_NAME,
            systemInstruction,
            true // Expect JSON output
        );

        const strategies = parseJsonSuggestions(generatedStrategies, 'strategies', 2);
        if (strategies.length > 0) {
            newPipeline.initialStrategies = strategies.map(s => ({
                id: `strat-${Date.now()}-${Math.random()}`,
                strategyText: s,
                judgingStatus: 'pending',
            }));
        } else {
            throw new Error("Failed to parse strategies from model output.");
        }
        newPipeline.status = 'completed'; // Or 'processing_hypotheses'
    } catch (error) {
        newPipeline.status = 'failed';
        newPipeline.error = error instanceof Error ? error.message : String(error);
        console.error("Error in Math Pipeline - Stage 1:", error);
    } finally {
        renderMathPipelineContent();
    }
}

function renderMathPipelineContent() {
    if (!pipelinesContentContainer || !activeMathPipeline) return;
    pipelinesContentContainer.innerHTML = ''; // Clear previous content

    const pipelineContent = document.createElement('div');
    pipelineContent.className = 'pipeline-content active';

    let contentHtml = `<h2>Math Problem</h2><p>${activeMathPipeline.problemText}</p>`;
    
    if (activeMathPipeline.initialStrategies.length > 0) {
        contentHtml += '<h3>Initial Strategies</h3>';
        contentHtml += '<div class="strategies-grid">';
        activeMathPipeline.initialStrategies.forEach(strat => {
            contentHtml += `<div class="strategy-card"><h5>Strategy</h5><p class="strategy-text">${strat.strategyText}</p></div>`;
        });
        contentHtml += '</div>';
    }

    if (activeMathPipeline.error) {
        contentHtml += `<p style="color: red;">Error: ${activeMathPipeline.error}</p>`;
    }

    pipelineContent.innerHTML = contentHtml;
    pipelinesContentContainer.appendChild(pipelineContent);
}

async function startGeneration() {
    console.log("Starting generation process...");
    if (isGenerating) {
        console.warn("Generation is already in progress.");
        return;
    }

    const { isValid, message } = configManager.checkRequiredConfig();
    if (!isValid) {
        alert(`Configuration Error: ${message}`);
        return;
    }

    initializeApiPoolManager();
    if (!aiPoolManager) {
        alert("API clients are not initialized. Please check your API key settings.");
        return;
    }

    isGenerating = true;
    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

    try {
        switch (currentMode) {
            case 'website':
                await runWebsitePipeline(); // This should now work
                break;
            case 'creative':
                // await runStandardPipeline(); // Placeholder
                console.log(`TODO: Implement runStandardPipeline for mode: ${currentMode}`);
                alert(`Pipeline for ${currentMode} mode is not yet implemented.`);
                break;
            case 'math':
                await runMathPipeline();
                break;
            case 'react':
                 // await runReactPipeline(); // Placeholder
                 console.log("TODO: Implement runReactPipeline");
                 alert("Pipeline for React mode is not yet implemented.");
                break;
            case 'agent':
                 // await runAgentPipeline(); // Placeholder
                 console.log("TODO: Implement runAgentPipeline");
                 alert("Pipeline for Agent mode is not yet implemented.");
                break;
            default:
                console.error(`Unknown application mode: ${currentMode}`);
                alert(`Unknown application mode: ${currentMode}`);
        }
    } catch (error) {
        console.error("An error occurred during the generation pipeline:", error);
        alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        isGenerating = false;
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
        console.log("Generation process finished.");
    }
}

function initializeApp() {
    console.log("Initializing application...");

    // --- Initialize Custom Prompts ---
    customPromptsWebsiteState = defaultCustomPromptsWebsite;
    customPromptsCreativeState = defaultCustomPromptsCreative;
    customPromptsMathState = createDefaultCustomPromptsMath(3, 3);
    customPromptsAgentState = createDefaultCustomPromptsAgent(3);
    customPromptsReactState = defaultCustomPromptsReact;
    console.log("Custom prompts initialized.");

    // --- Query DOM Elements ---
    initialIdeaInput = document.getElementById('initial-idea') as HTMLInputElement;
    generateButton = document.getElementById('generate-button') as HTMLButtonElement;
    appModeSelector = document.getElementById('app-mode-selector') as HTMLDivElement;
    modelSelectElement = document.getElementById('model-select') as HTMLSelectElement;
    tabsNavContainer = document.getElementById('tabs-nav-container') as HTMLDivElement;
    pipelinesContentContainer = document.getElementById('pipelines-content-container') as HTMLDivElement;
    
    // API Key Manager Elements
    aiProviderSelector = document.getElementById('ai-provider-select') as HTMLSelectElement;
    apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
    saveApiKeyButton = document.getElementById('save-api-key-button') as HTMLButtonElement;
    clearApiKeyButton = document.getElementById('clear-api-key-button') as HTMLButtonElement;
    const apiKeyFormContainer = document.getElementById('api-key-form-container') as HTMLElement;
    const openaiCustomConfig = document.getElementById('openai-custom-config') as HTMLElement;
    openaiBaseUrlInput = document.getElementById('openai-base-url') as HTMLInputElement;
    openaiModelNameInput = document.getElementById('openai-model-name') as HTMLInputElement;

    // Check if all essential elements are found
    if (!initialIdeaInput || !generateButton || !appModeSelector || !modelSelectElement || !aiProviderSelector) {
        console.error("One or more essential UI elements could not be found. App initialization failed.");
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.innerHTML = '<p style="color: red; font-family: sans-serif;">Error: UI elements missing. Check console.</p>';
        }
        return;
    }

    // --- API Key Manager Logic ---
    function handleProviderChange() {
        const provider = aiProviderSelector.value as AIProvider;
        apiKeyFormContainer.style.display = 'flex';
        openaiCustomConfig.style.display = provider === 'openai' ? 'flex' : 'none';
        loadAndApplyApiKey(provider);
    }

    aiProviderSelector.addEventListener('change', handleProviderChange);

    saveApiKeyButton.addEventListener('click', () => {
        const provider = aiProviderSelector.value as 'gemini' | 'openai';
        const key = apiKeyInput.value.trim();
        if (key) {
            let configToSave: ApiKeyConfig;
            if (provider === 'openai') {
                configToSave = {
                    key,
                    baseUrl: openaiBaseUrlInput.value.trim(),
                    modelName: openaiModelNameInput.value.trim()
                };
            } else {
                configToSave = { key };
            }
            saveApiKey(provider, configToSave);
            updateApiKeyUI(provider, true);
            alert(`${provider.toUpperCase()} API Key saved!`);
        } else {
            alert('Please enter an API key.');
        }
    });

    clearApiKeyButton.addEventListener('click', () => {
        const provider = aiProviderSelector.value as 'gemini' | 'openai';
        clearApiKey(provider);
        alert(`${provider.toUpperCase()} API Key cleared!`);
    });
    
    // --- Other Event Listeners ---
    generateButton.addEventListener('click', startGeneration);

    appModeSelector.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        if (target.name === 'appMode') {
            currentMode = target.value as ApplicationMode;
            console.log(`Application mode changed to: ${currentMode}`);
        }
    });

    // --- Initial Setup ---
    handleProviderChange(); // Initialize API key section based on default provider

    // Hide preloader now that the main UI is ready
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.classList.add('hidden');
        console.log("Preloader hidden.");
    }
    
    console.log("Application initialized successfully.");
}

document.addEventListener('DOMContentLoaded', initializeApp);

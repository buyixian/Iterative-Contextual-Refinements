/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Diff from 'diff';
import JSZip from 'jszip';
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { OpenAIAPI } from "./openai-client";
import { GeminiAPI } from "./gemini-client";
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import {
    defaultCustomPromptsWebsite,
    defaultCustomPromptsCreative,
    createDefaultCustomPromptsMath,
    createDefaultCustomPromptsAgent,
    defaultCustomPromptsReact, // Added for React mode
    systemInstructionHtmlOutputOnly, // Though not directly used in index.tsx, it's good to be aware it's here if needed
    systemInstructionJsonOutputOnly, // Same as above
    systemInstructionTextOutputOnly   // Same as above
} from './prompts.js';
import {
    ApplicationMode,
    AIProvider,
    PipelineState,
    MathPipelineState,
    ReactPipelineState,
    ApiClientPoolManager,
    CustomizablePromptsWebsite,
    CustomizablePromptsCreative,
    CustomizablePromptsMath,
    CustomizablePromptsAgent,
    CustomizablePromptsReact
} from './src/types';

// Constants for retry logic
const MAX_RETRIES = 3; // Max number of retries for API errors
const INITIAL_DELAY_MS = 2000; // Initial delay in milliseconds
const BACKOFF_FACTOR = 2; // Factor by which delay increases

/**
 * Custom error class to signify that pipeline processing was intentionally
 * stopped by a user request.
 */
class PipelineStopRequestedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PipelineStopRequestedError";
    }
}

// Type definitions have been moved to src/types.ts


const NUM_WEBSITE_REFINEMENT_ITERATIONS = 5;
const NUM_CREATIVE_REFINEMENT_ITERATIONS = 3;
export const NUM_AGENT_MAIN_REFINEMENT_LOOPS = 3;
const TOTAL_STEPS_WEBSITE = 1 + NUM_WEBSITE_REFINEMENT_ITERATIONS + 1;
const TOTAL_STEPS_CREATIVE = 1 + NUM_CREATIVE_REFINEMENT_ITERATIONS + 1;
// Agent steps: 1 (Judge) + 1 (Initial Gen) + 1 (Initial Refine/Suggest) + N (Loops) + 1 (Final Polish)
const TOTAL_STEPS_AGENT = 1 + 1 + 1 + NUM_AGENT_MAIN_REFINEMENT_LOOPS + 1;


export const NUM_INITIAL_STRATEGIES_MATH = 3;
export const NUM_SUB_STRATEGIES_PER_MAIN_MATH = 3;
const MATH_MODEL_NAME = "gemini-1.5-pro-latest"; // Use a specific, reliable model for math
const MATH_FIXED_TEMPERATURE = 1.0;


const temperatures = [0, 0.7, 1.0, 1.5, 2.0];

let pipelinesState: PipelineState[] = [];
let activeMathPipeline: MathPipelineState | null = null;
let activeReactPipeline: ReactPipelineState | null = null; // Added for React mode
let aiPoolManager: ApiClientPoolManager | null = null;
let activePipelineId: number | null = null;
let isGenerating = false;
let currentMode: ApplicationMode = 'website';
let currentProblemImageBase64: string | null = null;
let currentProblemImageMimeType: string | null = null;
// This variable is no longer used for the modal state but can be kept for config export/import
let isCustomPromptsOpen = false;


let customPromptsWebsiteState: CustomizablePromptsWebsite = JSON.parse(JSON.stringify(defaultCustomPromptsWebsite));
let customPromptsCreativeState: CustomizablePromptsCreative = JSON.parse(JSON.stringify(defaultCustomPromptsCreative));
let customPromptsMathState: CustomizablePromptsMath = createDefaultCustomPromptsMath(NUM_INITIAL_STRATEGIES_MATH, NUM_SUB_STRATEGIES_PER_MAIN_MATH);
let customPromptsAgentState: CustomizablePromptsAgent = createDefaultCustomPromptsAgent(NUM_AGENT_MAIN_REFINEMENT_LOOPS);
let customPromptsReactState: CustomizablePromptsReact = JSON.parse(JSON.stringify(defaultCustomPromptsReact)); // Added for React mode


const apiKeyStatusElement = document.getElementById('api-key-status') as HTMLElement;
const apiKeyFormContainer = document.getElementById('api-key-form-container') as HTMLElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const saveApiKeyButton = document.getElementById('save-api-key-button') as HTMLButtonElement;
const clearApiKeyButton = document.getElementById('clear-api-key-button') as HTMLButtonElement;
const openaiCustomConfig = document.getElementById('openai-custom-config') as HTMLElement;
const openaiBaseUrlInput = document.getElementById('openai-base-url') as HTMLInputElement;
const openaiModelNameInput = document.getElementById('openai-model-name') as HTMLInputElement;
const initialIdeaInput = document.getElementById('initial-idea') as HTMLTextAreaElement;
const initialIdeaLabel = document.getElementById('initial-idea-label') as HTMLLabelElement;
const mathProblemImageInputContainer = document.getElementById('math-problem-image-input-container') as HTMLElement;
const mathProblemImageInput = document.getElementById('math-problem-image-input') as HTMLInputElement;
const mathProblemImagePreview = document.getElementById('math-problem-image-preview') as HTMLImageElement;

const modelSelectionContainer = document.getElementById('model-selection-container') as HTMLElement;
const modelSelectElement = document.getElementById('model-select') as HTMLSelectElement;
const temperatureSelectionContainer = document.getElementById('temperature-selection-container') as HTMLElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const tabsNavContainer = document.getElementById('tabs-nav-container') as HTMLElement;
const pipelinesContentContainer = document.getElementById('pipelines-content-container') as HTMLElement;
const globalStatusDiv = document.getElementById('global-status') as HTMLElement;
const pipelineSelectorsContainer = document.getElementById('pipeline-selectors-container') as HTMLElement;
const appModeSelector = document.getElementById('app-mode-selector') as HTMLElement;
const aiProviderSelector = document.getElementById('ai-provider-select') as HTMLSelectElement;


// Prompts containers (now inside the modal)
const websitePromptsContainer = document.getElementById('website-prompts-container') as HTMLElement;
const creativePromptsContainer = document.getElementById('creative-prompts-container') as HTMLElement;
const mathPromptsContainer = document.getElementById('math-prompts-container') as HTMLElement;
const agentPromptsContainer = document.getElementById('agent-prompts-container') as HTMLElement;
const reactPromptsContainer = document.getElementById('react-prompts-container') as HTMLElement; // Added for React mode

// Custom Prompts Modal Elements
const promptsModalOverlay = document.getElementById('prompts-modal-overlay') as HTMLElement;
const promptsModalCloseButton = document.getElementById('prompts-modal-close-button') as HTMLButtonElement;
const customizePromptsTrigger = document.getElementById('customize-prompts-trigger') as HTMLElement;

// Diff Modal Elements
const diffModalOverlay = document.getElementById('diff-modal-overlay') as HTMLElement;
const diffModalCloseButton = document.getElementById('diff-modal-close-button') as HTMLButtonElement;
const diffSourceLabel = document.getElementById('diff-source-label') as HTMLParagraphElement;
const diffTargetTreeContainer = document.getElementById('diff-target-tree') as HTMLElement;
const diffViewerPanel = document.getElementById('diff-viewer-panel') as HTMLElement;

const exportConfigButton = document.getElementById('export-config-button') as HTMLButtonElement;
const importConfigInput = document.getElementById('import-config-input') as HTMLInputElement;
const importConfigLabel = document.getElementById('import-config-label') as HTMLLabelElement;

const customPromptTextareasWebsite: { [K in keyof CustomizablePromptsWebsite]: HTMLTextAreaElement | null } = {
    sys_initialGen: document.getElementById('sys-initial-gen') as HTMLTextAreaElement,
    user_initialGen: document.getElementById('user-initial-gen') as HTMLTextAreaElement,
    sys_initialBugFix: document.getElementById('sys-initial-bugfix') as HTMLTextAreaElement,
    user_initialBugFix: document.getElementById('user-initial-bugfix') as HTMLTextAreaElement,
    sys_initialFeatureSuggest: document.getElementById('sys-initial-features') as HTMLTextAreaElement,
    user_initialFeatureSuggest: document.getElementById('user-initial-features') as HTMLTextAreaElement,
    sys_refineStabilizeImplement: document.getElementById('sys-refine-implement') as HTMLTextAreaElement,
    user_refineStabilizeImplement: document.getElementById('user-refine-implement') as HTMLTextAreaElement,
    sys_refineBugFix: document.getElementById('sys-refine-bugfix') as HTMLTextAreaElement,
    user_refineBugFix: document.getElementById('user-refine-bugfix') as HTMLTextAreaElement,
    sys_refineFeatureSuggest: document.getElementById('sys-refine-features') as HTMLTextAreaElement,
    user_refineFeatureSuggest: document.getElementById('user-refine-features') as HTMLTextAreaElement,
    sys_finalPolish: document.getElementById('sys-final-polish') as HTMLTextAreaElement,
    user_finalPolish: document.getElementById('user-final-polish') as HTMLTextAreaElement,
};

const customPromptTextareasCreative: { [K in keyof CustomizablePromptsCreative]: HTMLTextAreaElement | null } = {
    sys_creative_initialDraft: document.getElementById('sys-creative-initial-draft') as HTMLTextAreaElement,
    user_creative_initialDraft: document.getElementById('user-creative-initial-draft') as HTMLTextAreaElement,
    sys_creative_initialCritique: document.getElementById('sys-creative-initial-critique') as HTMLTextAreaElement,
    user_creative_initialCritique: document.getElementById('user-creative-initial-critique') as HTMLTextAreaElement,
    sys_creative_refine_revise: document.getElementById('sys-creative-refine-revise') as HTMLTextAreaElement,
    user_creative_refine_revise: document.getElementById('user-creative-refine-revise') as HTMLTextAreaElement,
    sys_creative_refine_critique: document.getElementById('sys-creative-refine-critique') as HTMLTextAreaElement,
    user_creative_refine_critique: document.getElementById('user-creative-refine-critique') as HTMLTextAreaElement,
    sys_creative_final_polish: document.getElementById('sys-creative-final-polish') as HTMLTextAreaElement,
    user_creative_final_polish: document.getElementById('user-creative-final-polish') as HTMLTextAreaElement,
};

const customPromptTextareasMath: { [K in keyof CustomizablePromptsMath]: HTMLTextAreaElement | null } = {
    sys_math_initialStrategy: document.getElementById('sys-math-initial-strategy') as HTMLTextAreaElement,
    user_math_initialStrategy: document.getElementById('user-math-initial-strategy') as HTMLTextAreaElement,
    sys_math_subStrategy: document.getElementById('sys-math-sub-strategy') as HTMLTextAreaElement,
    user_math_subStrategy: document.getElementById('user-math-sub-strategy') as HTMLTextAreaElement,
    sys_math_solutionAttempt: document.getElementById('sys-math-solution-attempt') as HTMLTextAreaElement,
    user_math_solutionAttempt: document.getElementById('user-math-solution-attempt') as HTMLTextAreaElement,
    sys_math_selfImprovement: document.getElementById('sys-math-self-improvement') as HTMLTextAreaElement,
    user_math_selfImprovement: document.getElementById('user-math-self-improvement') as HTMLTextAreaElement,
    sys_math_hypothesisGeneration: document.getElementById('sys-math-hypothesis-generation') as HTMLTextAreaElement,
    user_math_hypothesisGeneration: document.getElementById('user-math-hypothesis-generation') as HTMLTextAreaElement,
    sys_math_prover: document.getElementById('sys-math-prover') as HTMLTextAreaElement,
    user_math_prover: document.getElementById('user-math-prover') as HTMLTextAreaElement,
    sys_math_disprover: document.getElementById('sys-math-disprover') as HTMLTextAreaElement,
    user_math_disprover: document.getElementById('user-math-disprover') as HTMLTextAreaElement,
};

const customPromptTextareasAgent: { [K in keyof CustomizablePromptsAgent]: HTMLTextAreaElement | null } = {
    sys_agent_judge_llm: document.getElementById('sys-agent-judge-llm') as HTMLTextAreaElement,
    user_agent_judge_llm: document.getElementById('user-agent-judge-llm') as HTMLTextAreaElement,
};

const customPromptTextareasReact: { [K in keyof CustomizablePromptsReact]: HTMLTextAreaElement | null } = { // Added for React mode
    sys_orchestrator: document.getElementById('sys-react-orchestrator') as HTMLTextAreaElement,
    user_orchestrator: document.getElementById('user-react-orchestrator') as HTMLTextAreaElement,
};

function initializeApiKey() {
    let statusMessage = "";
    let isKeyAvailable = false;
    let currentApiKey: string | null = null;
    let currentAIProvider = aiProviderSelector.value as AIProvider;

    // Hide form elements by default
    apiKeyFormContainer.style.display = 'none';
    saveApiKeyButton.style.display = 'none';
    clearApiKeyButton.style.display = 'none';
    apiKeyInput.style.display = 'none';
    openaiCustomConfig.style.display = 'none';

    // Show OpenAI custom config if OpenAI is selected
    if (currentAIProvider === 'openai') {
        openaiCustomConfig.style.display = 'flex';
    }

    const envKey = process.env.API_KEY;

    if (envKey) {
        statusMessage = "API Key loaded from environment.";
        isKeyAvailable = true;
        currentApiKey = envKey;
        apiKeyStatusElement.className = 'api-key-status-message status-badge status-ok';
    } else {
        apiKeyFormContainer.style.display = 'flex'; // Show the container for input/buttons
        const storedApiKey = localStorage.getItem(`${currentAIProvider}-api-key`);
        const storedBaseUrl = localStorage.getItem('openai-base-url');
        const storedModelName = localStorage.getItem('openai-model-name');
        
        if (storedApiKey) {
            statusMessage = `Using API Key from local storage for ${currentAIProvider}.`;
            isKeyAvailable = true;
            currentApiKey = storedApiKey;
            apiKeyStatusElement.className = 'api-key-status-message status-badge status-ok';
            clearApiKeyButton.style.display = 'inline-flex'; // Show clear button
            
            // Load OpenAI custom settings
            if (currentAIProvider === 'openai' && storedBaseUrl) {
                openaiBaseUrlInput.value = storedBaseUrl;
            }
            if (currentAIProvider === 'openai' && storedModelName) {
                openaiModelNameInput.value = storedModelName;
            }
        } else {
            statusMessage = "API Key not found. Please provide one.";
            isKeyAvailable = false;
            apiKeyStatusElement.className = 'api-key-status-message status-badge status-error';
            apiKeyInput.style.display = 'block'; // Show input field
            saveApiKeyButton.style.display = 'inline-flex'; // Show save button
            
            // Show OpenAI custom config if OpenAI is selected
            if (currentAIProvider === 'openai') {
                openaiCustomConfig.style.display = 'flex';
            }
        }
    }

    if (apiKeyStatusElement) {
        apiKeyStatusElement.textContent = statusMessage;
    }

    if (isKeyAvailable && currentApiKey) {
        try {
            // 统一处理多密钥（逗号分隔）
            const apiKeys = currentApiKey.includes(',')
                ? currentApiKey.split(',').map(key => key.trim()).filter(key => key.length > 0)
                : [currentApiKey];

            if (apiKeys.length === 0) {
                throw new Error("API key string is empty or contains only commas.");
            }

            // Create a pool of API clients, one for each key
            const clients: (GoogleGenAI | OpenAIAPI | GeminiAPI)[] = [];
            if (currentAIProvider === 'gemini') {
                // For Google GenAI, create a separate client for each key
                for (const key of apiKeys) {
                    clients.push(new GoogleGenAI({ apiKey: key }));
                }
            } else if (currentAIProvider === 'openai') {
                const baseUrl = openaiBaseUrlInput.value || localStorage.getItem('openai-base-url') || undefined;
                const modelName = openaiModelNameInput.value || localStorage.getItem('openai-model-name') || undefined;
                // For OpenAI, create a separate client for each key
                for (const key of apiKeys) {
                    clients.push(new OpenAIAPI({ apiKey: key, baseUrl, modelName }));
                }
            }

            // Create the pool manager with the clients and a round-robin getNextClient function
            aiPoolManager = {
                clients,
                currentIndex: 0,
                getNextClient: function () {
                    const client = this.clients[this.currentIndex];
                    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
                    return client;
                }
            };

            if (generateButton) generateButton.disabled = isGenerating;
            return true;
        } catch (e: any) {
            console.error(`Failed to initialize ${currentAIProvider} API:`, e);
            if (apiKeyStatusElement) {
                apiKeyStatusElement.textContent = `API Init Error`;
                apiKeyStatusElement.className = 'api-key-status-message status-badge status-error';
                apiKeyStatusElement.title = `Error: ${e.message}`;
            }
            if (generateButton) generateButton.disabled = true;
            aiPoolManager = null;
            return false;
        }
    } else {
        if (generateButton) generateButton.disabled = true;
        aiPoolManager = null;
        return false;
    }
}


function initializeCustomPromptTextareas() {
    // Website Prompts
    for (const key in customPromptTextareasWebsite) {
        const k = key as keyof CustomizablePromptsWebsite;
        const textarea = customPromptTextareasWebsite[k];
        if (textarea) {
            textarea.value = customPromptsWebsiteState[k];
            textarea.addEventListener('input', (e) => {
                customPromptsWebsiteState[k] = (e.target as HTMLTextAreaElement).value;
            });
        }
    }
    // Creative Prompts
    for (const key in customPromptTextareasCreative) {
        const k = key as keyof CustomizablePromptsCreative;
        const textarea = customPromptTextareasCreative[k];
        if (textarea) {
            textarea.value = customPromptsCreativeState[k];
            textarea.addEventListener('input', (e) => {
                customPromptsCreativeState[k] = (e.target as HTMLTextAreaElement).value;
            });
        }
    }
    // Math Prompts
    for (const key in customPromptTextareasMath) {
        const k = key as keyof CustomizablePromptsMath;
        const textarea = customPromptTextareasMath[k];
        if (textarea) {
            textarea.value = customPromptsMathState[k];
            textarea.addEventListener('input', (e) => {
                customPromptsMathState[k] = (e.target as HTMLTextAreaElement).value;
            });
        }
    }
    // Agent Prompts (for Judge LLM)
    for (const key in customPromptTextareasAgent) {
        const k = key as keyof CustomizablePromptsAgent;
        const textarea = customPromptTextareasAgent[k];
        if (textarea) {
            textarea.value = customPromptsAgentState[k];
            textarea.addEventListener('input', (e) => {
                customPromptsAgentState[k] = (e.target as HTMLTextAreaElement).value;
            });
        }
    }
    // React Prompts (for Orchestrator)
    for (const key in customPromptTextareasReact) {
        const k = key as keyof CustomizablePromptsReact;
        const textarea = customPromptTextareasReact[k];
        if (textarea) {
            textarea.value = customPromptsReactState[k];
            textarea.addEventListener('input', (e) => {
                customPromptsReactState[k] = (e.target as HTMLTextAreaElement).value;
            });
        }
    }
}

function updateCustomPromptTextareasFromState() {
    for (const key in customPromptTextareasWebsite) {
        const k = key as keyof CustomizablePromptsWebsite;
        const textarea = customPromptTextareasWebsite[k];
        if (textarea) textarea.value = customPromptsWebsiteState[k];
    }
    for (const key in customPromptTextareasCreative) {
        const k = key as keyof CustomizablePromptsCreative;
        const textarea = customPromptTextareasCreative[k];
        if (textarea) textarea.value = customPromptsCreativeState[k];
    }
    for (const key in customPromptTextareasMath) {
        const k = key as keyof CustomizablePromptsMath;
        const textarea = customPromptTextareasMath[k];
        if (textarea) textarea.value = customPromptsMathState[k];
    }
    for (const key in customPromptTextareasAgent) {
        const k = key as keyof CustomizablePromptsAgent;
        const textarea = customPromptTextareasAgent[k];
        if (textarea) textarea.value = customPromptsAgentState[k];
    }
    for (const key in customPromptTextareasReact) { // Added for React mode
        const k = key as keyof CustomizablePromptsReact;
        const textarea = customPromptTextareasReact[k];
        if (textarea) textarea.value = customPromptsReactState[k];
    }
}

const promptNavStructure = {
    website: [
        { groupTitle: "1. Initial Generation & Analysis", prompts: ["initial-gen", "initial-bugfix", "initial-features"] },
        { groupTitle: "2. Refinement Cycle", prompts: ["refine-implement", "refine-bugfix", "refine-features"] },
        { groupTitle: "3. Final Polish", prompts: ["final-polish"] }
    ],
    creative: [
        { groupTitle: "1. Drafting & Critique", prompts: ["creative-initial-draft", "creative-initial-critique"] },
        { groupTitle: "2. Revision Cycle", prompts: ["creative-refine-revise", "creative-refine-critique"] },
        { groupTitle: "3. Final Polish", prompts: ["creative-final-polish"] }
    ],
    math: [
        { groupTitle: "1. Strategic Solver", prompts: ["math-initial-strategy", "math-sub-strategy", "math-solution-attempt", "math-self-improvement"] },
        { groupTitle: "2. Hypothesis Explorer", prompts: ["math-hypothesis-generation", "math-prover", "math-disprover"] }
    ],
    agent: [
        { groupTitle: "Agent Configuration", prompts: ["agent-judge-llm"] }
    ],
    react: [
        { groupTitle: "Orchestrator Agent", prompts: ["react-orchestrator"] }
    ]
};

function initializePromptsModal() {
    const navContainer = document.getElementById('prompts-modal-nav');
    const contentContainer = document.getElementById('prompts-modal-content');
    if (!navContainer || !contentContainer) return;

    // Clear previous state
    navContainer.innerHTML = '';
    contentContainer.querySelectorAll('.prompts-mode-container').forEach(el => el.classList.remove('active'));
    contentContainer.querySelectorAll('.prompt-content-pane').forEach(el => el.classList.remove('active'));

    const activeModeContainer = document.getElementById(`${currentMode}-prompts-container`);
    if (!activeModeContainer) return;

    activeModeContainer.classList.add('active');

    // Display current mode at the top of nav
    const modeTitle = document.createElement('h4');
    modeTitle.className = 'prompts-nav-mode-title';
    modeTitle.textContent = `${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode Prompts`;
    navContainer.appendChild(modeTitle);

    const navStructure = promptNavStructure[currentMode as keyof typeof promptNavStructure];
    if (!navStructure) return;

    let firstNavItem: HTMLElement | null = null;

    navStructure.forEach(group => {
        const groupTitleEl = document.createElement('h5');
        groupTitleEl.className = 'prompts-nav-group-title';
        groupTitleEl.textContent = group.groupTitle;
        navContainer.appendChild(groupTitleEl);

        group.prompts.forEach(promptKey => {
            const pane = activeModeContainer.querySelector<HTMLElement>(`.prompt-content-pane[data-prompt-key="${promptKey}"]`);
            if (!pane) return;

            const titleElement = pane.querySelector<HTMLHeadingElement>('.prompt-pane-title');
            const title = titleElement ? titleElement.textContent : 'Unnamed Section';

            const navItem = document.createElement('div');
            navItem.className = 'prompts-nav-item';
            navItem.textContent = title;
            navItem.dataset.targetPane = promptKey;
            navContainer.appendChild(navItem);

            if (!firstNavItem) {
                firstNavItem = navItem;
            }

            navItem.addEventListener('click', () => {
                // Deactivate all nav items and panes first
                navContainer.querySelectorAll('.prompts-nav-item').forEach(item => item.classList.remove('active'));
                activeModeContainer.querySelectorAll('.prompt-content-pane').forEach(p => p.classList.remove('active'));

                // Activate the clicked one
                navItem.classList.add('active');
                pane.classList.add('active');
            });
        });
    });

    // Activate the first one by default
    if (firstNavItem) {
        (firstNavItem as HTMLElement).click();
    }
}


function setPromptsModalVisible(visible: boolean) {
    if (promptsModalOverlay) {
        if (visible) {
            initializePromptsModal(); // Re-initialize on open to reflect current mode
            promptsModalOverlay.style.display = 'flex';
            setTimeout(() => {
                promptsModalOverlay.classList.add('is-visible');
            }, 10);
        } else {
            promptsModalOverlay.classList.remove('is-visible');
            promptsModalOverlay.addEventListener('transitionend', () => {
                if (!promptsModalOverlay.classList.contains('is-visible')) {
                    promptsModalOverlay.style.display = 'none';
                }
            }, { once: true });
        }
    }
}

function updateUIAfterModeChange() {
    // Visibility of prompt containers is now handled by CSS classes and initializePromptsModal
    const allPromptContainers = document.querySelectorAll('.prompts-mode-container');
    allPromptContainers.forEach(container => container.classList.remove('active'));
    const activeContainer = document.getElementById(`${currentMode}-prompts-container`);
    if (activeContainer) activeContainer.classList.add('active');

    // Default UI states
    if (mathProblemImageInputContainer) mathProblemImageInputContainer.style.display = 'none';
    if (modelSelectionContainer) modelSelectionContainer.style.display = 'flex';
    if (temperatureSelectionContainer) temperatureSelectionContainer.style.display = 'block';

    const generateButtonText = generateButton?.querySelector('.button-text');

    if (generateButtonText) {
        switch (currentMode) {
            case 'website':
                generateButtonText.textContent = 'Generate Website';
                initialIdeaLabel.textContent = 'Initial Idea / Feature Request:';
                initialIdeaInput.placeholder = 'e.g., A portfolio website for a photographer, with a gallery page and a contact';
                break;

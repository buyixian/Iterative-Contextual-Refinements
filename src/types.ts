/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This file contains type definitions migrated from the legacy index.tsx.
// These types will be used to build out the new React components and state management.

export type ApplicationMode = 'website' | 'creative' | 'math' | 'agent' | 'react';
export type AIProvider = 'gemini' | 'openai';

// A generic interface for the API client pool manager.
// The specific client types will be handled in the new implementation.
export interface ApiClientPoolManager {
  clients: any[];
  currentIndex: number;
  getNextClient(): any;
}
export interface AgentGeneratedPrompts {
    iteration_type_description: string;
    expected_output_content_type: string; // e.g., "python", "text", "markdown"
    placeholders_guide: Record<string, string>;
    initial_generation: { system_instruction: string; user_prompt_template: string; };
    feature_implementation: { system_instruction: string; user_prompt_template: string; };
    refinement_and_suggestion: { system_instruction: string; user_prompt_template: string; }; // Expected to output JSON: { refined_content: string, suggestions: string[] }
    final_polish: { system_instruction: string; user_prompt_template: string; };
}

export interface IterationData {
    iterationNumber: number;
    title: string;
    // Website Mode Specific
    requestPromptHtml_InitialGenerate?: string;
    requestPromptHtml_FeatureImplement?: string;
    requestPromptHtml_BugFix?: string;
    requestPromptFeatures_Suggest?: string;
    generatedHtml?: string;
    suggestedFeatures?: string[]; // Used by Website for general suggestions
    // Creative Writing Mode Specific
    requestPromptText_GenerateDraft?: string;
    requestPromptText_Critique?: string;
    requestPromptText_Revise?: string;
    requestPromptText_Polish?: string;
    generatedOrRevisedText?: string;
    critiqueSuggestions?: string[];
    // Agent Mode Specific
    agentJudgeLLM_InitialRequest?: string; // Prompt to Judge LLM
    agentGeneratedPrompts?: AgentGeneratedPrompts; // Output from Judge LLM (stored in iter 0)
    requestPrompt_SysInstruction?: string; // Dynamically set system instruction for the current step
    requestPrompt_UserTemplate?: string; // Dynamically set user prompt template
    requestPrompt_Rendered?: string; // Actual rendered prompt sent to API
    generatedMainContent?: string; // Main output of an agent step (text, code, etc.)
    // For agent loop iterations that have two sub-steps (implement, then refine/suggest)
    requestPrompt_SubStep_SysInstruction?: string;
    requestPrompt_SubStep_UserTemplate?: string;
    requestPrompt_SubStep_Rendered?: string;
    generatedSubStep_Content?: string;
    generatedSuggestions?: string[]; // For Agent mode's refine/suggest step output

    status: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    error?: string;
    isDetailsOpen?: boolean;
    retryAttempt?: number;
}

export interface PipelineState {
    id: number;
    originalTemperatureIndex: number;
    temperature: number;
    modelName: string;
    iterations: IterationData[];
    status: 'idle' | 'running' | 'stopping' | 'stopped' | 'completed' | 'failed';
    isStopRequested?: boolean;
}

// Math Mode Specific Interfaces
export interface MathSubStrategyData {
    id: string; // e.g., "main1-sub1"
    subStrategyText: string;
    requestPromptSolutionAttempt?: string;
    solutionAttempt?: string;

    // New fields for self-improvement and refinement
    requestPromptSelfImprovement?: string;
    refinedSolution?: string;
    selfImprovementStatus?: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    selfImprovementError?: string;
    selfImprovementRetryAttempt?: number;

    status: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    error?: string;
    isDetailsOpen?: boolean;
    retryAttempt?: number;
}

export interface MathHypothesisData {
    id: string; // e.g., "hyp1", "hyp2", "hyp3"
    hypothesisText: string;

    // Prover agent data
    proverRequestPrompt?: string;
    proverAttempt?: string;
    proverStatus: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    proverError?: string;
    proverRetryAttempt?: number;

    // Disprover agent data
    disproverRequestPrompt?: string;
    disproverAttempt?: string;
    disproverStatus: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    disproverError?: string;
    disproverRetryAttempt?: number;

    // Final status determination
    finalStatus: 'pending' | 'proven' | 'refuted' | 'unresolved' | 'contradiction';
    isDetailsOpen?: boolean;
}
export interface MathMainStrategyData {
    id: string; // e.g., "main1"
    strategyText: string;
    requestPromptSubStrategyGen?: string;
    subStrategies: MathSubStrategyData[];
    status: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled'; // for sub-strategy generation
    error?: string; // error during sub-strategy generation for this main strategy
    isDetailsOpen?: boolean;
    retryAttempt?: number; // for sub-strategy generation step

    // New fields for judging sub-strategies
    judgedBestSubStrategyId?: string;
    judgedBestSolution?: string; // The full text of the best solution with reasoning.
    judgingRequestPrompt?: string;
    judgingResponseText?: string; // The raw response from the judge
    judgingStatus?: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    judgingError?: string;
    judgingRetryAttempt?: number;
}
export interface MathPipelineState {
    id: string; // unique ID for this math problem instance
    problemText: string;
    problemImageBase64?: string | null; // Base64 encoded image
    problemImageMimeType?: string;
    requestPromptInitialStrategyGen?: string;
    initialStrategies: MathMainStrategyData[];
    status: 'idle' | 'processing' | 'retrying' | 'completed' | 'error' | 'stopping' | 'stopped' | 'cancelled'; // Overall status
    error?: string; // Overall error for the whole process
    isStopRequested?: boolean;
    activeTabId?: string; // e.g., "problem-details", "strategic-solver", "hypothesis-explorer", "final-result"
    retryAttempt?: number; // for initial strategy generation step

    // New fields for Hypothesis Explorer (Track B)
    requestPromptHypothesisGen?: string;
    hypotheses: MathHypothesisData[];
    hypothesisGenStatus?: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    hypothesisGenError?: string;
    hypothesisGenRetryAttempt?: number;

    // Knowledge packet synthesized from hypothesis exploration
    knowledgePacket?: string;

    // Synchronization flags
    strategicSolverComplete?: boolean; // Track A completion
    hypothesisExplorerComplete?: boolean; // Track B completion

    // New fields for final judging
    finalJudgedBestStrategyId?: string;
    finalJudgedBestSolution?: string;
    finalJudgingRequestPrompt?: string;
    finalJudgingResponseText?: string;
    finalJudgingStatus?: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    finalJudgingError?: string;
    finalJudgingRetryAttempt?: number;
}


export interface CustomizablePromptsWebsite {
    sys_initialGen: string;
    user_initialGen: string;
    sys_initialBugFix: string;
    user_initialBugFix: string;
    sys_initialFeatureSuggest: string;
    user_initialFeatureSuggest: string;
    sys_refineStabilizeImplement: string;
    user_refineStabilizeImplement: string;
    sys_refineBugFix: string;
    user_refineBugFix: string;
    sys_refineFeatureSuggest: string;
    user_refineFeatureSuggest: string;
    sys_finalPolish: string;
    user_finalPolish: string;
}

export interface CustomizablePromptsCreative {
    sys_creative_initialDraft: string;
    user_creative_initialDraft: string; // {{initialPremise}}
    sys_creative_initialCritique: string;
    user_creative_initialCritique: string; // {{currentDraft}}
    sys_creative_refine_revise: string;
    user_creative_refine_revise: string; // {{currentDraft}}, {{critiqueToImplementStr}}
    sys_creative_refine_critique: string;
    user_creative_refine_critique: string; // {{currentDraft}}
    sys_creative_final_polish: string;
    user_creative_final_polish: string; // {{currentDraft}}
}

export interface CustomizablePromptsMath {
    sys_math_initialStrategy: string;
    user_math_initialStrategy: string; // {{originalProblemText}} (+ image if provided)
    sys_math_subStrategy: string;
    user_math_subStrategy: string; // {{originalProblemText}}, {{currentMainStrategy}}, {{otherMainStrategiesStr}} (+ image)
    sys_math_solutionAttempt: string;
    user_math_solutionAttempt: string; // {{originalProblemText}}, {{currentSubStrategy}}, {{knowledgePacket}} (+ image)

    // New prompts for self-improvement and refinement
    sys_math_selfImprovement: string;
    user_math_selfImprovement: string; // {{originalProblemText}}, {{currentSubStrategy}}, {{solutionAttempt}}, {{knowledgePacket}} (+ image)

    // New prompts for hypothesis exploration
    sys_math_hypothesisGeneration: string;
    user_math_hypothesisGeneration: string; // {{originalProblemText}} (+ image)
    sys_math_prover: string;
    user_math_prover: string; // {{originalProblemText}}, {{hypothesis}} (+ image)
    sys_math_disprover: string;
    user_math_disprover: string; // {{originalProblemText}}, {{hypothesis}} (+ image)
}

export interface CustomizablePromptsAgent {
    sys_agent_judge_llm: string; // System instruction for the Judge LLM
    user_agent_judge_llm: string; // User prompt template for Judge LLM (e.g., "{{initialRequest}}", "{{NUM_AGENT_MAIN_REFINEMENT_LOOPS}}")
}

// React Mode Specific Interfaces
export interface ReactModeStage {
    id: number; // 0-4 for the 5 worker agents
    title: string; // e.g., "Agent 1: UI Components" - defined by Orchestrator
    systemInstruction?: string; // Generated by Orchestrator for this worker agent
    userPrompt?: string; // Generated by Orchestrator for this worker agent (can be a template)
    renderedUserPrompt?: string; // If the userPrompt is a template
    generatedContent?: string; // Code output from this worker agent
    status: 'pending' | 'processing' | 'retrying' | 'completed' | 'error' | 'cancelled';
    error?: string;
    isDetailsOpen?: boolean;
    retryAttempt?: number;
}

export interface ReactPipelineState {
    id: string; // Unique ID for this React mode process run
    userRequest: string;
    orchestratorSystemInstruction: string; // The system prompt used for the orchestrator
    orchestratorPlan?: string; // plan.txt generated by Orchestrator
    orchestratorRawOutput?: string; // Full raw output from orchestrator (for debugging/inspection)
    stages: ReactModeStage[]; // Array of 5 worker agent stages
    finalAppendedCode?: string; // Combined code from all worker agents
    status: 'idle' | 'orchestrating' | 'processing_workers' | 'completed' | 'error' | 'stopping' | 'stopped' | 'cancelled' | 'orchestrating_retrying' | 'failed';
    error?: string;
    isStopRequested?: boolean;
    activeTabId?: string; // To track which of the 5 worker agent tabs is active in UI, e.g., "worker-0", "worker-1"
    orchestratorRetryAttempt?: number;
}

export interface CustomizablePromptsReact {
    sys_orchestrator: string; // System instruction for the Orchestrator Agent
    user_orchestrator: string; // User prompt template for Orchestrator Agent {{user_request}}
}
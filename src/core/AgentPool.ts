import { IAgent, ModelDefinition, WorkflowRole, WorkflowContext } from '../types/workflow';
import { GeminiAgent } from './GeminiAgent';
import { OpenAICompatibleAgent } from './OpenAICompatibleAgent';

export interface ApiKeys {
    google?: string;
    deepseek?: string[];
    openai?: string;
}

/**
 * A factory and cache for dynamically creating agent instances at runtime.
 * An "agent" is a temporary, stateful entity created by combining a
 * Model (the "brain") and a Role (the "personality" or system prompt).
 */
export class AgentPool {
    private agentCache: Map<string, IAgent> = new Map();
    private apiKeys: ApiKeys;
    private deepseekKeyIndex = 0;

    constructor(apiKeys: ApiKeys = {}) {
        this.apiKeys = apiKeys;
    }

    /**
     * Retrieves a cached agent instance or creates a new one if it doesn't exist.
     * The cache key is a combination of the role's ID and the model's ID.
     * @param role The role the agent will perform, providing the system prompt.
     * @param model The model definition to use as the agent's "brain".
     * @returns An instance of an IAgent.
     */
    public getAgent(role: WorkflowRole, model: ModelDefinition): IAgent {
        const cacheKey = `${role.id}:${model.id}`;
        if (this.agentCache.has(cacheKey)) {
            return this.agentCache.get(cacheKey)!;
        }

        const agent = this.createAgent(role, model);
        this.agentCache.set(cacheKey, agent);
        return agent;
    }

    private createAgent(role: WorkflowRole, model: ModelDefinition): IAgent {
        const { system_prompt } = role;

        switch (model.provider) {
            case 'google':
                const googleApiKey = this.apiKeys.google;
                if (!googleApiKey) throw new Error(`Google API key is missing for model: ${model.name}`);
                return new GeminiAgent(model, system_prompt, googleApiKey);

            case 'openai_compatible':
                const deepseekKeys = this.apiKeys.deepseek;
                if (!deepseekKeys || deepseekKeys.length === 0) {
                    // Fallback to openai key if deepseek keys are not available
                    const openaiKey = this.apiKeys.openai;
                    if (!openaiKey) throw new Error(`API key for openai_compatible provider is missing for model: ${model.name}`);
                    return new OpenAICompatibleAgent(model, system_prompt, openaiKey);
                }
                
                // Round-robin logic for DeepSeek keys
                const keyToUse = deepseekKeys[this.deepseekKeyIndex % deepseekKeys.length];
                this.deepseekKeyIndex++;
                
                console.log(`Using DeepSeek key index: ${this.deepseekKeyIndex - 1}, key ending with: ...${keyToUse.slice(-4)}`);

                return new OpenAICompatibleAgent(model, system_prompt, keyToUse);

            default:
                // This case should ideally not be reached if models.json is well-formed.
                throw new Error(`Unsupported provider '${model.provider}' for model '${model.name}'.`);
        }
    }
}
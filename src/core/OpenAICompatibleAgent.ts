import OpenAI from "openai";
import { IAgent, ModelDefinition, WorkflowContext } from "../types/workflow";

/**
 * An agent that uses an OpenAI-compatible API (like DeepSeek).
 */
export class OpenAICompatibleAgent implements IAgent {
    public model: ModelDefinition;
    public system_prompt: string;
    private client: OpenAI;

    /**
     * Creates an instance of OpenAICompatibleAgent.
     * @param model The model definition to use.
     * @param system_prompt The system prompt to guide the agent's behavior.
     * @param apiKey The API key for the service.
     */
    constructor(model: ModelDefinition, system_prompt: string, apiKey: string) {
        if (!apiKey) {
            throw new Error("API key is required for OpenAICompatibleAgent.");
        }
        this.model = model;
        this.system_prompt = system_prompt;
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: this.model.api_base_url || 'https://api.deepseek.com/v1', // Default for DeepSeek
            dangerouslyAllowBrowser: true, // Required for use in browser environments
        });
    }

    /**
     * Executes the agent's task by calling an OpenAI-compatible API.
     * @param prompt The prompt to send to the model.
     * @param context The current workflow context.
     * @returns The text response from the model.
     */
    async execute(prompt: string, context: WorkflowContext): Promise<string> {
        console.log(`OpenAICompatibleAgent (${this.model.name}) executing with model ${this.model.id}...`);
        try {
            const chatCompletion = await this.client.chat.completions.create({
                messages: [
                    { role: "system", content: this.system_prompt },
                    { role: "user", content: prompt }
                ],
                model: this.model.id,
            });
            
            const content = chatCompletion.choices[0]?.message?.content;
            if (!content) {
                throw new Error("No content in response from OpenAI-compatible API.");
            }
            return content;

        } catch (error) {
            console.error(`Error executing OpenAICompatibleAgent (${this.model.name}):`, error);
            throw new Error(`OpenAI-compatible API call failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
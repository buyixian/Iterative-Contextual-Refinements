import { IAgent, ModelDefinition, WorkflowContext } from "../types/workflow";

/**
 * An agent that uses the Google Gemini REST API.
 * This implementation avoids the @google/generative-ai SDK to bypass module resolution issues.
 */
export class GeminiAgent implements IAgent {
    public model: ModelDefinition;
    public system_prompt: string;
    private apiKey: string;
    private apiEndpoint: string;

    /**
     * Creates an instance of GeminiAgent.
     * @param model The model definition to use.
     * @param system_prompt The system prompt to guide the agent's behavior.
     * @param apiKey The Google AI API key.
     */
    constructor(model: ModelDefinition, system_prompt: string, apiKey: string) {
        if (!apiKey) {
            throw new Error("Google API key is required for GeminiAgent.");
        }
        this.model = model;
        this.system_prompt = system_prompt;
        this.apiKey = apiKey;
        // Construct the API endpoint from the model name
        this.apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model.id}:generateContent`;
    }

    /**
     * Executes the agent's task by calling the Gemini REST API.
     * @param prompt The input prompt for the agent.
     * @param context The current workflow context (unused by this agent for now).
     * @param options Optional parameters for the execution, such as sampling settings.
     * @returns The text response from the model.
     */
    async execute(prompt: string, context: WorkflowContext, options?: { temperature?: number }): Promise<string> {
        console.log(`GeminiAgent (${this.model.name}) executing with model ${this.model.id} via REST API...`);
        
        const requestBody = {
            systemInstruction: {
                parts: [{
                    text: this.system_prompt
                }]
            },
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: options?.temperature ?? 0.7 // Default temperature
            }
        };

        try {
            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error(`Gemini API Error Response (${this.model.name}):`, errorBody);
                throw new Error(`Gemini API call failed with status ${response.status}: ${errorBody.error?.message || response.statusText}`);
            }

            const responseData = await response.json();
            
            // Extract the text from the response
            const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

            if (typeof text !== 'string') {
                console.error(`Unexpected response structure from Gemini API (${this.model.name}):`, responseData);
                throw new Error("Failed to extract text from Gemini API response.");
            }

            return text;
        } catch (error) {
            console.error(`Error executing GeminiAgent (${this.model.name}):`, error);
            throw new Error(`Gemini REST API call failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper functions to get environment variables
function getEnv(key: string): string | undefined {
    // In a browser environment, process.env might not be available.
    // Vite replaces process.env.KEY with the value at build time.
    // We can use import.meta.env for Vite-specific env vars.
    return (import.meta.env as any)[key];
}

function getArrayEnv(key: string): string[] {
    const value = getEnv(key);
    if (!value) {
        return [];
    }
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function getEnvOrDefault(key: string, defaultValue: string): string {
    return getEnv(key) || defaultValue;
}

export interface ApiKeyConfig {
    key: string;
    baseUrl?: string;
    modelName?: string;
}

class AppConfig {
    private static instance: AppConfig;

    // API Keys from different sources
    googleGenaiApiKeys: ApiKeyConfig[] = [];
    openaiApiKeys: ApiKeyConfig[] = [];

    // Other configurations
    defaultModel: string;
    timeoutMs: number;

    private constructor() {
        console.log("AppConfig: Initializing configuration...");
        // Load from environment variables first
        this.loadFromEnv();
        // Then, load from localStorage, which can override env vars if present
        this.loadFromLocalStorage();
        
        this.defaultModel = getEnvOrDefault('VITE_DEFAULT_MODEL', 'gpt-4-turbo');
        this.timeoutMs = parseInt(getEnvOrDefault('VITE_TIMEOUT_MS', '30000'), 10);
        console.log("AppConfig: Initialization complete.", this);
    }

    public static getInstance(): AppConfig {
        if (!AppConfig.instance) {
            AppConfig.instance = new AppConfig();
        }
        return AppConfig.instance;
    }

    private loadFromEnv() {
        console.log("AppConfig: Loading from environment variables...");
        const googleKeys = getArrayEnv('VITE_GOOGLE_GENAI_API_KEY');
        if (googleKeys.length > 0) {
            this.googleGenaiApiKeys = googleKeys.map(key => ({ key }));
            console.log(`AppConfig: Loaded ${googleKeys.length} Google GenAI keys from .env.`);
        }

        const openaiKeys = getArrayEnv('VITE_OPENAI_API_KEY');
        if (openaiKeys.length > 0) {
            const baseUrl = getEnv('VITE_OPENAI_BASE_URL');
            this.openaiApiKeys = openaiKeys.map(key => ({ key, baseUrl }));
             console.log(`AppConfig: Loaded ${openaiKeys.length} OpenAI keys from .env.`);
        }
    }

    public loadFromLocalStorage() {
        console.log("AppConfig: Loading from localStorage...");
        try {
            const storedGoogle = localStorage.getItem('gemini_apiKey');
            if (storedGoogle) {
                this.googleGenaiApiKeys = [JSON.parse(storedGoogle)];
                console.log("AppConfig: Loaded Google GenAI key from localStorage.");
            }

            const storedOpenAI = localStorage.getItem('openai_apiKey');
            if (storedOpenAI) {
                this.openaiApiKeys = [JSON.parse(storedOpenAI)];
                 console.log("AppConfig: Loaded OpenAI key from localStorage.");
            }
        } catch (e) {
            console.error("AppConfig: Error loading configuration from localStorage", e);
        }
    }

    public updateApiKey(provider: 'gemini' | 'openai', config: ApiKeyConfig | null) {
        console.log(`AppConfig: Updating API key for ${provider}`, config);
        if (provider === 'gemini') {
            this.googleGenaiApiKeys = config ? [config] : [];
        } else {
            this.openaiApiKeys = config ? [config] : [];
        }
        this.loadFromLocalStorage(); // Reload to ensure consistency
    }

    public checkRequiredConfig(): { isValid: boolean; message: string } {
        console.log("AppConfig: Checking required configuration...");
        if (this.googleGenaiApiKeys.length === 0 && this.openaiApiKeys.length === 0) {
            const message = 'No API keys found. Please add a key via the UI or set VITE_GOOGLE_GENAI_API_KEY or VITE_OPENAI_API_KEY in your .env file.';
            console.warn(`AppConfig Check: FAILED - ${message}`);
            return { isValid: false, message };
        }

        if (this.openaiApiKeys.length > 0) {
            const openaiConfig = this.openaiApiKeys[0];
            if (!openaiConfig.baseUrl) {
                 const message = 'OpenAI API key is set, but the Base URL is missing. Please set it in the UI or as VITE_OPENAI_BASE_URL in your .env file.';
                 console.warn(`AppConfig Check: FAILED - ${message}`);
                 return { isValid: false, message };
            }
        }
        
        console.log("AppConfig Check: PASSED");
        return { isValid: true, message: 'Configuration is valid.' };
    }
}

export const configManager = AppConfig.getInstance();

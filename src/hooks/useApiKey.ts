import { useState, useEffect, useCallback } from 'react';

export interface ApiKeys {
  google?: string;
  deepseek?: string[];
  openai?: string;
}

const API_KEYS_STORAGE_KEY = 'react-app-api-keys';

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    google: import.meta.env.VITE_GOOGLE_API_KEY || '',
    deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY ? [import.meta.env.VITE_DEEPSEEK_API_KEY] : [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedKeysJSON = localStorage.getItem(API_KEYS_STORAGE_KEY);
      if (storedKeysJSON) {
        const storedKeys = JSON.parse(storedKeysJSON);
        // Handle backward compatibility for deepseek key being a string
        if (typeof storedKeys.deepseek === 'string') {
          storedKeys.deepseek = [storedKeys.deepseek];
        }
        // Merge stored keys over the initial env-based values
        setApiKeys(prevKeys => ({ ...prevKeys, ...storedKeys }));
      }
    } catch (error) {
      console.error("Failed to read API keys from localStorage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveApiKeys = useCallback((keys: ApiKeys) => {
    try {
      const newKeys = { ...apiKeys, ...keys };
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(newKeys));
      setApiKeys(newKeys);
    } catch (error) {
      console.error("Failed to save API keys to localStorage", error);
    }
  }, [apiKeys]);

  const clearApiKeys = useCallback(() => {
    try {
      localStorage.removeItem(API_KEYS_STORAGE_KEY);
      setApiKeys({});
    } catch (error) {
      console.error("Failed to clear API keys from localStorage", error);
    }
  }, []);

  return {
    apiKeys,
    isLoading,
    saveApiKeys,
    clearApiKeys,
  };
}
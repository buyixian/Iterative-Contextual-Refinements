import React, { createContext, useContext, ReactNode } from 'react';
import { useApiKeys, ApiKeys } from '../hooks/useApiKey';

interface ApiKeyContextType {
  apiKeys: ApiKeys;
  isLoading: boolean;
  saveApiKeys: (keys: ApiKeys) => void;
  clearApiKeys: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const apiKeyManager = useApiKeys();

  return (
    <ApiKeyContext.Provider value={apiKeyManager}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKeyContext() {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKeyContext must be used within an ApiKeyProvider');
  }
  return context;
}
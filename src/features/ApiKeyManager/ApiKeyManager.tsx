import React, { useState, useEffect } from 'react';
import { useApiKeyContext } from '../../context/ApiKeyContext';
import './ApiKeyManager.css';

export function ApiKeyManager() {
  const { apiKeys: storedKeys, isLoading, saveApiKeys, clearApiKeys } = useApiKeyContext();
  const [googleKey, setGoogleKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');

  useEffect(() => {
    if (!isLoading) {
      setGoogleKey(storedKeys.google || '');
      setGoogleKey(storedKeys.google || '');
      // Join array into a newline-separated string for the textarea
      setDeepseekKey(Array.isArray(storedKeys.deepseek) ? storedKeys.deepseek.join('\n') : '');
    }
  }, [isLoading, storedKeys]);

  const handleSave = () => {
    // Split the newline-separated string into an array of keys, filtering out empty lines
    const deepseekKeys = deepseekKey.split('\n').map(k => k.trim()).filter(k => k);
    saveApiKeys({ google: googleKey, deepseek: deepseekKeys });
    alert('API Keys saved!');
  };

  const handleClear = () => {
    clearApiKeys();
  };

  const getStatus = () => {
    if (isLoading) {
      return 'Loading keys...';
    }
    const hasGoogleKey = !!storedKeys.google;
    const hasDeepseekKey = !!(storedKeys.deepseek && storedKeys.deepseek.length > 0);
    if (hasGoogleKey && hasDeepseekKey) return 'All API Keys are set';
    if (hasGoogleKey) return 'Google Key is set; DeepSeek Key is missing';
    if (hasDeepseekKey) return 'DeepSeek Key is set; Google Key is missing';
    return 'API Keys not set';
  };

  return (
    <div className="api-key-manager">
      <p className="api-key-status">{getStatus()}</p>
      <div className="api-key-form">
        <div className="input-group">
          <label htmlFor="google-key">Google Gemini API Key</label>
          <input
            id="google-key"
            type="password"
            value={googleKey}
            onChange={(e) => setGoogleKey(e.target.value)}
            placeholder="Enter Google Gemini Key"
            className="api-key-input"
            disabled={isLoading}
          />
        </div>
        <div className="input-group">
          <label htmlFor="deepseek-key">DeepSeek API Keys (one per line)</label>
          <textarea
            id="deepseek-key"
            value={deepseekKey}
            onChange={(e) => setDeepseekKey(e.target.value)}
            placeholder="Enter DeepSeek Keys, one per line"
            className="api-key-textarea"
            rows={5}
            disabled={isLoading}
          />
        </div>
        <div className="api-key-buttons">
          <button onClick={handleSave} className="button" disabled={isLoading}>Save Keys</button>
          <button onClick={handleClear} className="button" disabled={isLoading || (!storedKeys.google && (!storedKeys.deepseek || storedKeys.deepseek.length === 0))}>Clear All</button>
        </div>
      </div>
    </div>
  );
}
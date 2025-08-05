import React from 'react';
import { Button } from '../../components/ui/Button';
import { useApiKeyContext } from '../../context/ApiKeyContext';

export function GenerateButton() {
  const { apiKeys, isLoading } = useApiKeyContext();

  const handleGenerate = () => {
    alert('开始生成... (逻辑待实现)');
  };

  const isButtonDisabled = isLoading || (!apiKeys.google && !apiKeys.deepseek);

  return (
    <div style={{ marginTop: 'auto' }}>
      <Button 
        variant="primary" 
        onClick={handleGenerate} 
        disabled={isButtonDisabled}
        style={{ width: '100%' }}
      >
        {isLoading ? '检查密钥...' : '生成'}
      </Button>
      {isButtonDisabled && !isLoading && (
        <p style={{ fontSize: '0.8rem', color: '#6c757d', textAlign: 'center', marginTop: '0.5rem' }}>
          请输入 API Key 以启用生成功能。
        </p>
      )}
    </div>
  );
}
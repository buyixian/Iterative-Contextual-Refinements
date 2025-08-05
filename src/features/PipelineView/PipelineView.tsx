import React, { useState } from 'react';
import './PipelineView.css';

type Tab = 'Original' | 'Transformed' | 'Final';

export const PipelineView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('Original');

  const renderContent = () => {
    switch (activeTab) {
      case 'Original':
        return <div>原始代码将显示在这里。</div>;
      case 'Transformed':
        return <div>转换后的代码将显示在这里。</div>;
      case 'Final':
        return <div>最终代码将显示在这里。</div>;
      default:
        return null;
    }
  };

  return (
    <div className="pipeline-view">
      <div className="tabs">
        <button onClick={() => setActiveTab('Original')} className={activeTab === 'Original' ? 'active' : ''}>
          原始
        </button>
        <button onClick={() => setActiveTab('Transformed')} className={activeTab === 'Transformed' ? 'active' : ''}>
          转换后
        </button>
        <button onClick={() => setActiveTab('Final')} className={activeTab === 'Final' ? 'active' : ''}>
          最终
        </button>
      </div>
      <div className="tab-content">
        {renderContent()}
      </div>
    </div>
  );
};
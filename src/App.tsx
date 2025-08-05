import React, { useState } from 'react';
import { ApiKeyManager } from './features/ApiKeyManager/ApiKeyManager';
import { ModeSelector } from './features/ModeSelector/ModeSelector';
// import { useAppMode } from './context/AppModeContext'; // No longer used
import { GenerateButton } from './features/GenerateButton/GenerateButton';
import { PromptsModal } from './features/PromptsModal/PromptsModal';
import { DiffModal } from './features/DiffModal/DiffModal';
// import { PipelineView } from './features/PipelineView/PipelineView';
import { Button } from './components/ui/Button';
import { WorkflowManager } from './features/WorkflowManager/WorkflowManager';

function App() {
  // const { currentMode, setMode } = useAppMode(); // No longer used
  const [isPromptsModalOpen, setIsPromptsModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  return (
    <div className="app">
      <aside className="sidebar">
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1>控制面板</h1>
          <ApiKeyManager />
          {/* <ModeSelector currentMode={currentMode} onModeChange={setMode} />
          <Button onClick={() => setIsPromptsModalOpen(true)}>编辑 Prompts</Button>
          <Button onClick={() => setIsDiffModalOpen(true)}>查看 Diff</Button> */}
        </div>
        {/* <GenerateButton /> */}
      </aside>
      <main className="main-content">
        <WorkflowManager />
      </main>
      {/* <PromptsModal isOpen={isPromptsModalOpen} onClose={() => setIsPromptsModalOpen(false)} />
      <DiffModal isOpen={isDiffModalOpen} onClose={() => setIsDiffModalOpen(false)} /> */}
    </div>
  );
}

export default App;
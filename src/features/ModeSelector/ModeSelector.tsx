import React from 'react';
import './ModeSelector.css';

// 定义应用模式的类型
export type ApplicationMode = 'website' | 'creative' | 'math' | 'agent' | 'react';

const MODES: { id: ApplicationMode; label: string }[] = [
  { id: 'website', label: 'HTML' },
  { id: 'creative', label: 'Writing' },
  { id: 'math', label: 'Math' },
  { id: 'agent', label: 'Agent' },
  { id: 'react', label: 'React' },
];

interface ModeSelectorProps {
  currentMode: ApplicationMode;
  onModeChange: (mode: ApplicationMode) => void;
}

export function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <label className="mode-label">Application Mode</label>
      <div className="radio-group">
        {MODES.map(({ id, label }) => (
          <label key={id} className="radio-label">
            <input
              type="radio"
              name="appMode"
              value={id}
              checked={currentMode === id}
              onChange={() => onModeChange(id)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
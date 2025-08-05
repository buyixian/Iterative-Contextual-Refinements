import React from 'react';
import './PromptsModal.css';

interface PromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PromptsModal: React.FC<PromptsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>编辑提示 (Prompts)</h2>
        <p>这里将是编辑提示的表单。</p>
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  );
};
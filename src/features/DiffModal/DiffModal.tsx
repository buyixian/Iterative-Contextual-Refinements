import React from 'react';
import './DiffModal.css';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>内容差异对比</h2>
        <p>这里将显示生成内容前后的差异。</p>
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  );
};
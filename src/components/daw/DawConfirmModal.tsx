/**
 * MusicSkills - DAW Confirmation Modal
 * Professional in-app confirmation dialog replacing native browser confirm() popups.
 * Strictly zero-emoji.
 */

import React from 'react';

interface DawConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export const DawConfirmModal: React.FC<DawConfirmModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '400px',
          backgroundColor: '#17191E',
          border: '1px solid #2D3139',
          borderRadius: '8px',
          padding: '22px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, color: '#F3F4F6' }}>
          {title}
        </h4>
        <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#9CA3AF', lineHeight: 1.5 }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 14px',
              backgroundColor: '#252932',
              border: 'none',
              borderRadius: '4px',
              color: '#F3F4F6',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: '7px 16px',
              backgroundColor: isDestructive ? '#FF5252' : '#8B78FF',
              border: 'none',
              borderRadius: '4px',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};


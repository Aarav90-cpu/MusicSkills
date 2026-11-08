/**
 * MusicSkills Professional DAW - Rename Modal
 * Clean dialog for renaming tracks and projects without ugly browser prompt() dialogs.
 * Strictly zero-emoji.
 */

import React, { useState, useEffect, useRef } from 'react';

interface DawRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialValue: string;
  onConfirm: (newName: string) => void;
}

export const DawRenameModal: React.FC<DawRenameModalProps> = ({
  isOpen,
  onClose,
  title,
  initialValue,
  onConfirm,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '380px',
          backgroundColor: '#17191E',
          border: '1px solid #2D3139',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#F3F4F6' }}>
          {title}
        </h4>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            backgroundColor: '#111216',
            border: '1px solid #3F4452',
            borderRadius: '4px',
            color: '#F3F4F6',
            fontSize: '12px',
            boxSizing: 'border-box',
            marginBottom: '16px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2A2E37',
              border: 'none',
              borderRadius: '4px',
              color: '#F3F4F6',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '6px 16px',
              backgroundColor: '#8B78FF',
              border: 'none',
              borderRadius: '4px',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

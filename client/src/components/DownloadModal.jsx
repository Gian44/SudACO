import React, { useState } from 'react';

const TARGET_OPTIONS = [
  { id: 'initial', label: 'Initial Grid' },
  { id: 'solved', label: 'Solved Sudoku Puzzle/Current Progress' }
];

const FORMAT_OPTIONS = [
  { id: 'txt', label: '.txt' },
  { id: 'pdf', label: '.pdf' }
];

function DownloadModal({
  isOpen,
  onClose,
  onConfirm,
  disabledTargets = new Set(),
  confirmDisabled = false
}) {
  const [target, setTarget] = useState('initial');
  const [format, setFormat] = useState('txt');

  if (!isOpen) return null;

  const targetDisabled = disabledTargets.has(target);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="download-modal-title">
      <div className="modal-content w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 id="download-modal-title" className="text-xl font-bold text-gradient">Download Puzzle</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">What to download</p>
            <div className="grid grid-cols-1 gap-2">
              {TARGET_OPTIONS.map((option) => {
                const disabled = disabledTargets.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`btn ${target === option.id ? 'btn-primary' : 'btn-secondary'} ${disabled ? 'opacity-60' : ''}`}
                    onClick={() => setTarget(option.id)}
                    disabled={disabled}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">File format</p>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`btn ${format === option.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormat(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {targetDisabled && (
          <p className="text-sm text-[var(--color-warning)] mt-3">
            Selected puzzle data is not available yet.
          </p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-success"
            disabled={targetDisabled || confirmDisabled}
            onClick={() => onConfirm({ target, format })}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default DownloadModal;

import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';

const CALLOUTS = [
  {
    id: 1,
    label: 'Number entry',
    description: 'Press 1-9 (or valid range for puzzle size) to fill selected cell.',
    position: { top: '20%', left: '20%' }
  },
  {
    id: 2,
    label: 'Clear cell',
    description: 'Use Backspace/Delete to clear selected entry or notes.',
    position: { top: '20%', left: '56%' }
  },
  {
    id: 3,
    label: 'Navigate cells',
    description: 'Use arrow keys to move selection across the board.',
    position: { top: '62%', left: '22%' }
  },
  {
    id: 4,
    label: 'Toggle Notes',
    description: 'Use N to switch between value entry and note entry.',
    position: { top: '62%', left: '66%' }
  }
];

function ShortcutsDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Keyboard Shortcut Cheatsheet"
      description="Shortcuts speed up gameplay, especially on larger boards."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
      showCanvasCallouts={false}
    >
      <div className={`about-mock about-mock-shortcuts ${activeClass}`}>
        <div className="shortcut-group region-1">
          <span className="label">Numbers</span>
          <div className="keys">
            {Array.from({ length: 9 }).map((_, i) => (
              <kbd key={i}>{i + 1}</kbd>
            ))}
          </div>
        </div>
        <div className="shortcut-group region-2">
          <span className="label">Clear</span>
          <div className="keys">
            <kbd>Backspace</kbd>
            <kbd>Delete</kbd>
          </div>
        </div>
        <div className="shortcut-group region-3">
          <span className="label">Move</span>
          <div className="keys">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>←</kbd>
            <kbd>→</kbd>
          </div>
        </div>
        <div className="shortcut-group region-4">
          <span className="label">Mode</span>
          <div className="keys">
            <kbd>N</kbd>
          </div>
        </div>
      </div>
    </AboutDiagram>
  );
}

export default ShortcutsDiagram;

import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';

const CALLOUTS = [
  {
    id: 1,
    label: 'Row rule',
    description: 'Every row must contain each number exactly once.',
    position: { top: '17%', left: '26%' }
  },
  {
    id: 2,
    label: 'Column rule',
    description: 'Every column must contain each number exactly once.',
    position: { top: '45%', left: '11%' }
  },
  {
    id: 3,
    label: 'Box rule',
    description: 'Each sub-box also contains each number exactly once.',
    position: { top: '40%', left: '49%' }
  },
  {
    id: 4,
    label: 'Fixed clues',
    description: 'Given numbers are fixed and cannot be edited.',
    position: { top: '78%', left: '75%' }
  }
];

const SAMPLE_GIVENS = {
  '0-0': '9', '0-1': '8', '0-3': '7', '0-5': '6',
  '1-0': '7', '1-3': '5', '1-6': '9',
  '2-2': '5', '2-4': '6',
  '3-0': '8', '3-7': '4',
  '4-1': '5', '4-3': '3', '4-6': '8',
  '5-2': '9', '5-8': '6',
  '6-0': '3', '6-1': '7', '6-4': '2',
  '7-2': '8', '7-3': '6', '7-6': '3',
  '8-4': '3', '8-8': '1'
};

function SudokuRulesDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Sudoku Rules Visual Guide"
      description="Highlighted areas show the four core Sudoku constraints."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
    >
      <div className={`about-mock ${activeClass}`} style={{ minHeight: '320px' }}>
        <div className="region-1" style={{ padding: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Row highlight</div>
        </div>
        <div
          className="region-2"
          style={{
            position: 'absolute',
            left: '12px',
            top: '55px',
            width: '28px',
            height: '220px'
          }}
        />
        <div
          className="region-3"
          style={{
            position: 'absolute',
            left: '150px',
            top: '120px',
            width: '86px',
            height: '86px'
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            border: '2px solid #8b5cf6',
            borderRadius: '10px',
            overflow: 'hidden',
            width: 'min(420px, 100%)',
            margin: '6px auto 0'
          }}
        >
          {Array.from({ length: 81 }).map((_, i) => {
            const row = Math.floor(i / 9);
            const col = i % 9;
            const key = `${row}-${col}`;
            const value = SAMPLE_GIVENS[key] || '';
            const isGiven = Boolean(value);
            const thickRight = col === 2 || col === 5;
            const thickBottom = row === 2 || row === 5;
            return (
              <div
                key={key}
                className={`region-4 ${isGiven ? 'about-rule-given' : ''}`}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(148,163,184,0.28)',
                  borderRightWidth: thickRight ? '2px' : '1px',
                  borderBottomWidth: thickBottom ? '2px' : '1px',
                  borderRightColor: thickRight ? '#8b5cf6' : 'rgba(148,163,184,0.28)',
                  borderBottomColor: thickBottom ? '#8b5cf6' : 'rgba(148,163,184,0.28)',
                  fontWeight: isGiven ? 800 : 500,
                  color: isGiven ? '#a78bfa' : 'var(--color-text-muted)',
                  fontSize: '0.82rem',
                  background: 'rgba(37,37,66,0.52)'
                }}
              >
                {value}
              </div>
            );
          })}
        </div>
      </div>
    </AboutDiagram>
  );
}

export default SudokuRulesDiagram;

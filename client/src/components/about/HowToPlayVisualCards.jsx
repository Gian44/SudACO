import React from 'react';

const SAMPLE_VALUES = {
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

function MiniBoard({ mode = 'row' }) {
  const isRow = mode === 'row';
  const isCol = mode === 'col';
  const isBox = mode === 'box';
  const isFixed = mode === 'fixed';
  const isConflict = mode === 'conflict';
  const isConstrained = mode === 'constrained';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(9, 1fr)',
        width: '180px',
        border: '2px solid #8b5cf6',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'rgba(15,23,42,0.65)'
      }}
    >
      {Array.from({ length: 81 }).map((_, i) => {
        const row = Math.floor(i / 9);
        const col = i % 9;
        const key = `${row}-${col}`;
        let value = SAMPLE_VALUES[key] || '';

        const thickRight = col === 2 || col === 5;
        const thickBottom = row === 2 || row === 5;
        const rowHighlight = isRow && row === 2;
        const colHighlight = isCol && col === 4;
        const boxHighlight = isBox && row >= 3 && row <= 5 && col >= 3 && col <= 5;
        const constrainedHighlight = isConstrained && (row === 0 || col === 0 || (row <= 2 && col <= 2));
        const fixedCell = value !== '';

        let background = 'rgba(51,65,85,0.45)';
        if (rowHighlight || colHighlight || boxHighlight || constrainedHighlight) {
          background = 'rgba(139,92,246,0.30)';
        }

        if (isConflict && (key === '0-1' || key === '0-5')) {
          value = '8';
          background = 'rgba(239,68,68,0.28)';
        }

        if (mode === 'notes' && key === '4-4') {
          value = '';
        }

        return (
          <div
            key={key}
            style={{
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(148,163,184,0.24)',
              borderRightWidth: thickRight ? '2px' : '1px',
              borderBottomWidth: thickBottom ? '2px' : '1px',
              borderRightColor: thickRight ? '#8b5cf6' : 'rgba(148,163,184,0.24)',
              borderBottomColor: thickBottom ? '#8b5cf6' : 'rgba(148,163,184,0.24)',
              fontSize: '10px',
              fontWeight: isFixed && fixedCell ? 800 : 600,
              color: isFixed && fixedCell ? '#c4b5fd' : '#a78bfa',
              background
            }}
          >
            {mode === 'notes' && key === '4-4' ? '1·4·7' : value}
          </div>
        );
      })}
    </div>
  );
}

function VisualCard({ title, text, mode, index }) {
  return (
    <div className="card" style={{ padding: '14px' }}>
      <div className="flex items-start gap-3">
        <span className="about-legend-number" style={{ marginTop: '2px' }}>{index}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">{text}</p>
          <MiniBoard mode={mode} />
        </div>
      </div>
    </div>
  );
}

export function CoreRuleVisualCards() {
  const items = [
    {
      title: 'Row rule',
      text: 'Each row must contain numbers 1 to N exactly once (N depends on puzzle size).',
      mode: 'row'
    },
    {
      title: 'Column rule',
      text: 'Each column must also contain numbers 1 to N exactly once.',
      mode: 'col'
    },
    {
      title: 'Box rule',
      text: 'Each sub-box must contain numbers 1 to N exactly once.',
      mode: 'box'
    },
    {
      title: 'Fixed clues',
      text: 'Given clues are fixed and cannot be changed.',
      mode: 'fixed'
    },
    {
      title: 'Logic over guessing',
      text: 'No guessing is required; valid puzzles are solvable through logic.',
      mode: 'notes'
    }
  ];

  return (
    <div className="grid gap-3">
      {items.map((item, idx) => (
        <VisualCard key={item.title} title={item.title} text={item.text} mode={item.mode} index={idx + 1} />
      ))}
    </div>
  );
}

export function SolvingHabitVisualCards() {
  const items = [
    {
      title: 'Scan systematically',
      text: 'Scan rows, columns, and boxes for missing numbers.',
      mode: 'row'
    },
    {
      title: 'Candidate elimination',
      text: 'Use candidate elimination before committing a value.',
      mode: 'notes'
    },
    {
      title: 'Conflict checks',
      text: 'If a conflict appears, re-check duplicates in the same row, column, or box.',
      mode: 'conflict'
    },
    {
      title: 'Constrained-first strategy',
      text: 'Work from constrained areas first (rows/columns with many filled cells).',
      mode: 'constrained'
    }
  ];

  return (
    <div className="grid gap-3">
      {items.map((item, idx) => (
        <VisualCard key={item.title} title={item.title} text={item.text} mode={item.mode} index={idx + 1} />
      ))}
    </div>
  );
}

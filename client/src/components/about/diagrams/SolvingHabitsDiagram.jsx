import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';

const CALLOUTS = [
  {
    id: 1,
    label: 'Scan systematically',
    description: 'Check rows, columns, and boxes for missing values first.',
    position: { top: '18%', left: '20%' }
  },
  {
    id: 2,
    label: 'Use candidates',
    description: 'Track possible numbers before committing a cell value.',
    position: { top: '35%', left: '76%' }
  },
  {
    id: 3,
    label: 'Resolve conflicts',
    description: 'If duplicates appear, backtrack and fix row/col/box violations.',
    position: { top: '58%', left: '22%' }
  },
  {
    id: 4,
    label: 'Prioritize constrained areas',
    description: 'Focus on rows/columns with many filled cells to narrow options quickly.',
    position: { top: '80%', left: '70%' }
  }
];

function SolvingHabitsDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Helpful Solving Habits"
      description="Practical workflow for solving puzzles consistently."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
    >
      <div className={`about-mock ${activeClass}`} style={{ minHeight: '300px', padding: '12px' }}>
        <div className="region-1" style={{ padding: '10px' }}>
          <strong style={{ fontSize: '0.86rem' }}>1) Scan board</strong>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
            Identify near-complete rows, columns, and boxes.
          </p>
        </div>
        <div className="region-2" style={{ padding: '10px' }}>
          <strong style={{ fontSize: '0.86rem' }}>2) Add candidates</strong>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
            Use notes to compare candidate overlap.
          </p>
        </div>
        <div className="region-3" style={{ padding: '10px' }}>
          <strong style={{ fontSize: '0.86rem' }}>3) Validate conflicts</strong>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
            Re-check any duplicate value highlighted in red.
          </p>
        </div>
        <div className="region-4" style={{ padding: '10px' }}>
          <strong style={{ fontSize: '0.86rem' }}>4) Commit in tight zones</strong>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
            Place values where constraints are strongest.
          </p>
        </div>
      </div>
    </AboutDiagram>
  );
}

export default SolvingHabitsDiagram;

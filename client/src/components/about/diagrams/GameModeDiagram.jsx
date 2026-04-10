import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';
import sudacoLogo from '../../../assets/sudaco-logo.svg';

const CALLOUTS = [
  {
    id: 1,
    label: 'Header and branding',
    description: 'SudACO identity plus puzzle size and difficulty indicators.',
    position: { top: '10%', left: '18%' }
  },
  {
    id: 2,
    label: 'Timer and New Puzzle',
    description: 'Track elapsed time and open a fresh puzzle immediately.',
    position: { top: '10%', left: '73%' }
  },
  {
    id: 3,
    label: 'Sudoku grid',
    description: 'Main 9x9 board where givens and user entries are displayed.',
    position: { top: '43%', left: '37%' }
  },
  {
    id: 4,
    label: 'Number pad',
    description: 'Use keypad input for fast cell entry and quick delete.',
    position: { top: '78%', left: '30%' }
  },
  {
    id: 5,
    label: 'Notes and Solve controls',
    description: 'Switch notes state and run solver from the bottom action row.',
    position: { top: '89%', left: '42%' }
  },
  {
    id: 6,
    label: 'Download puzzle',
    description: 'Export the current puzzle to a .txt file.',
    position: { top: '20%', left: '40%' }
  }
];

const GIVEN_VALUES = {
  '0-7': '3',
  '0-8': '9',
  '1-5': '1',
  '1-8': '5',
  '2-2': '3',
  '2-4': '5',
  '2-6': '8',
  '3-2': '8',
  '3-4': '9',
  '3-8': '6',
  '4-1': '7',
  '4-5': '2',
  '5-0': '1',
  '5-3': '4',
  '6-2': '9',
  '6-4': '8',
  '6-7': '5',
  '7-1': '2',
  '7-6': '6',
  '8-0': '4',
  '8-3': '7'
};

function GameModeDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const [notesOn, setNotesOn] = useState(false);
  const [solvingOn, setSolvingOn] = useState(false);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Game Mode Screen Map"
      description="Hover callouts or legend items to spotlight each area."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
      showCanvasCallouts={false}
    >
      <div className={`about-mock about-mock-game ${activeClass}`}>
        <div className="about-game-top">
          <div className="about-game-brand region-1">
            <img src={sudacoLogo} alt="SudACO logo" className="brand-icon" />
            <span className="brand-text">
              <strong>SudACO</strong>
              <em>Sudoku Game</em>
            </span>
            <span className="size-label">9x9</span>
            <span className="difficulty-pill">HARD ★★★★</span>
          </div>
          <div className="about-game-meta region-2">
            <span className="meta-timer">00:01</span>
            <span className="meta-new">+ New Puzzle</span>
          </div>
        </div>
        <div className="about-game-download region-6">
          <span className="download-btn">Download Puzzle (.txt)</span>
        </div>
        <div className="about-game-board-wrap region-3">
          <div className={`about-mock-grid ${notesOn ? 'notes-on' : ''}`}>
            {Array.from({ length: 81 }).map((_, i) => {
              const row = Math.floor(i / 9);
              const col = i % 9;
              const key = `${row}-${col}`;
              const value = GIVEN_VALUES[key] || '';
              const thickRight = col === 2 || col === 5;
              const thickBottom = row === 2 || row === 5;
              return (
                <span
                  key={key}
                  className={`cell ${value ? 'given' : ''} ${thickRight ? 'thick-right' : ''} ${thickBottom ? 'thick-bottom' : ''}`}
                >
                  {value}
                </span>
              );
            })}
          </div>
        </div>
        <div className="about-game-pad region-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="key">{i + 1}</span>
          ))}
          <span className="key delete">⌫</span>
        </div>
        <div className="about-game-actions region-5">
          <span className={`action notes ${notesOn ? 'is-on' : ''}`}>{notesOn ? 'Notes ON' : 'Notes OFF'}</span>
          <span className={`action solve ${solvingOn ? 'is-on' : ''}`}>{solvingOn ? 'Solving...' : 'Solve'}</span>
        </div>
        <div className="about-mock-toggles">
          <button type="button" onClick={() => setNotesOn((v) => !v)}>
            {notesOn ? 'Notes: ON' : 'Notes: OFF'}
          </button>
          <button type="button" onClick={() => setSolvingOn((v) => !v)}>
            {solvingOn ? 'Solving: ON' : 'Solving: OFF'}
          </button>
        </div>
      </div>
    </AboutDiagram>
  );
}

export default GameModeDiagram;

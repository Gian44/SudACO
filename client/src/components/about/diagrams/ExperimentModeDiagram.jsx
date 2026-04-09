import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';
import sudacoLogo from '../../../assets/sudaco-logo.svg';

const CALLOUTS = [
  {
    id: 1,
    label: 'Shared play surface',
    description: 'Experiment mode keeps the board, number pad, and notes flow.',
    position: { top: '53%', left: '30%' }
  },
  {
    id: 2,
    label: 'Header controls',
    description: 'Main Menu access and New Puzzle flow remain available.',
    position: { top: '10%', left: '75%' }
  },
  {
    id: 3,
    label: 'Experiment panel',
    description: 'Tune timeout, ants, colonies, and all algorithm parameters.',
    position: { top: '53%', left: '78%' }
  },
  {
    id: 4,
    label: 'Solve with parameters',
    description: 'Runs solver using the current panel snapshot values.',
    position: { top: '86%', left: '78%' }
  }
];

function ExperimentModeDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);
  const givens = {
    '0-0': '9', '0-1': '8', '0-3': '7', '0-6': '6',
    '1-0': '7', '1-3': '5', '1-6': '9',
    '2-2': '4', '2-7': '3',
    '3-0': '8', '3-3': '6', '3-6': '5',
    '4-1': '2',
    '5-4': '1', '5-8': '6',
    '6-0': '5', '6-5': '7',
    '7-1': '9', '7-4': '5', '7-5': '6', '7-6': '8',
    '8-2': '8', '8-3': '9'
  };

  return (
    <AboutDiagram
      title="Experiment Mode Screen Map"
      description="Experiment mode keeps gameplay visible while exposing solver controls."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
      showCanvasCallouts={false}
    >
      <div className={`about-mock about-mock-experiment ${activeClass}`}>
        <div className="exp-top region-2">
          <div className="exp-brand">
            <img src={sudacoLogo} alt="SudACO logo" className="logo" />
            <span className="title">
              <strong>SudACO</strong>
              <em>Sudoku Game</em>
            </span>
          </div>
          <div className="exp-header-actions">
            <span className="timer">02:01</span>
            <span className="pause">II</span>
            <span className="new">+ New Puzzle</span>
          </div>
        </div>
        <div className="exp-size-row">
          <span>9x9</span>
          <span>HARD ★★★★</span>
        </div>

        <div className="exp-layout">
          <div className="exp-grid region-1">
            <div className="exp-board">
              {Array.from({ length: 81 }).map((_, i) => {
                const row = Math.floor(i / 9);
                const col = i % 9;
                const key = `${row}-${col}`;
                const value = givens[key] || '';
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
            <div className="exp-pad">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
              <span>Del</span>
            </div>
            <div className="exp-bottom-actions">
              <span>Notes OFF</span>
            </div>
          </div>

          <div className="exp-panel region-3">
            <div className="exp-title">Experiment Controls</div>
            <div className="exp-library-btn">Open Puzzle Library</div>
            <div className="exp-fields">
              {['Timeout', 'nAnts', 'numACS', 'q0', 'xi', 'rho', 'evap', 'convThresh', 'Entropy %'].map((field) => (
                <span key={field} className="field">{field}</span>
              ))}
            </div>
            <div className="exp-entropy">Computed entropyThresh: 1.466090</div>
            <div className="exp-solve region-4">Solve</div>
          </div>
        </div>
      </div>
    </AboutDiagram>
  );
}

export default ExperimentModeDiagram;

import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';
import sudacoLogo from '../../../assets/sudaco-logo.svg';

const CALLOUTS = [
  {
    id: 1,
    label: 'Lobby header',
    description: 'Branding bar with logo and Sudoku Game subtitle.',
    position: { top: '11%', left: '22%' }
  },
  {
    id: 2,
    label: 'Play cards',
    description: 'Game Mode and Experiment Mode are featured at the top.',
    position: { top: '42%', left: '33%' }
  },
  {
    id: 3,
    label: 'Tools & Info cards',
    description: 'Create Puzzle, Upload Puzzle, and About Game options.',
    position: { top: '74%', left: '34%' }
  },
  {
    id: 4,
    label: 'Footer hint',
    description: 'Status hints like autosave and start guidance.',
    position: { top: '93%', left: '34%' }
  }
];

function MainMenuDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Main Menu Navigation Map"
      description="Use this map to decide where to go based on your task."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
      showCanvasCallouts={false}
    >
      <div className={`about-mock about-mock-menu ${activeClass}`}>
        <div className="manual-menu-header region-1">
          <div className="brand">
            <img src={sudacoLogo} alt="SudACO logo" className="logo" />
            <span className="title">
              <strong>SudACO</strong>
              <em>Sudoku Game</em>
            </span>
          </div>
        </div>

        <div className="manual-menu-play region-2">
          <span className="label">PLAY</span>
          <div className="play-card game">
            <strong>Game Mode</strong>
            <em>Enter the Sudoku arena, race the solver, and claim your victory PDF.</em>
          </div>
          <div className="play-card experiment">
            <strong>Experiment Mode</strong>
            <em>Play with side controls for parameters and puzzle library.</em>
          </div>
        </div>

        <div className="manual-menu-tools region-3">
          <span className="label">TOOLS & INFO</span>
          <div className="tools-grid">
            <div className="tool-card create">
              <strong>Create Puzzle</strong>
              <em>Generate a puzzle in-browser and start playing.</em>
            </div>
            <div className="tool-card upload">
              <strong>Upload Puzzle</strong>
              <em>Upload your own puzzle file and play it.</em>
            </div>
            <div className="tool-card about">
              <strong>About Game</strong>
              <em>Read the user manual and Game Mode instructions.</em>
            </div>
          </div>
        </div>

        <div className="manual-menu-footer region-4">
          Pick a mode to begin • Progress auto-saves during play
        </div>
      </div>
    </AboutDiagram>
  );
}

export default MainMenuDiagram;

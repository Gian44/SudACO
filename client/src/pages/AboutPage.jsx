import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AboutTabs from '../components/about/AboutTabs';
import GameModeDiagram from '../components/about/diagrams/GameModeDiagram';
import PuzzleModalDiagram from '../components/about/diagrams/PuzzleModalDiagram';
import MainMenuDiagram from '../components/about/diagrams/MainMenuDiagram';
import ExperimentModeDiagram from '../components/about/diagrams/ExperimentModeDiagram';
import ExportDiagram from '../components/about/diagrams/ExportDiagram';

function AboutPage() {
  const [activeTab, setActiveTab] = useState('howToPlay');

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto card about-page">
        <h1 className="text-3xl font-bold text-gradient mb-3">About Game</h1>
        <p className="about-intro">
          SudACO is a Sudoku web app powered by WebAssembly solvers. Use this guide to learn gameplay,
          discover every app section, and troubleshoot common issues.
        </p>

        <AboutTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'howToPlay' && (
          <section className="about-section">
            <h2>How to Play (Game Mode)</h2>
            <p>
              Game Mode is the fastest path for standard Sudoku play. Start from a puzzle source, fill
              values and notes, then solve manually or with the built-in solver.
            </p>

            <div className="about-subsection">
              <h3>Step-by-step workflow</h3>
              <ol>
                <li>
                  Press <strong>Choose Puzzle</strong> and select a source (Daily, Library, Upload, or My Puzzles).
                </li>
                <li>
                  Read the board: fixed givens are locked, while empty cells are editable.
                </li>
                <li>
                  Select a cell and enter numbers using keyboard or Number Pad.
                </li>
                <li>
                  Toggle <strong>Notes</strong> to place candidate values when unsure.
                </li>
                <li>
                  Use row/column/box highlights and conflict coloring to locate mistakes quickly.
                </li>
                <li>
                  Press <strong>Solve</strong> to run default parameters; press <strong>Stop</strong> to cancel an active run.
                </li>
                <li>
                  After successful solving, use <strong>Download PDF</strong> for original vs solved board plus parameter snapshot.
                </li>
              </ol>
            </div>

            <GameModeDiagram />

            <div className="about-subsection">
              <h3>Puzzle source behavior</h3>
              <ul>
                <li><strong>Daily:</strong> one rotating daily challenge.</li>
                <li><strong>Library:</strong> preloaded puzzles across sizes and difficulties.</li>
                <li><strong>Upload:</strong> load supported `.txt` puzzle files.</li>
                <li><strong>My Puzzles:</strong> puzzles you created or uploaded previously.</li>
              </ul>
            </div>

            <PuzzleModalDiagram />
          </section>
        )}

        {activeTab === 'userManual' && (
          <section className="about-section">
            <h2>User Manual</h2>
            <p>
              This manual covers all sections in SudACO: navigation, puzzle sources, solving, exports,
              persistence, and troubleshooting.
            </p>

            <div className="about-subsection">
              <h3>Navigation and app sections</h3>
              <ul>
                <li><strong>Game Mode:</strong> streamlined play + default solve + export actions.</li>
                <li><strong>Experiment Mode:</strong> side panel for tuning algorithm parameters.</li>
                <li><strong>Create Puzzle:</strong> build manually or generate with algorithm.</li>
                <li><strong>Upload Puzzle:</strong> import puzzle files and jump into play.</li>
                <li><strong>About Game:</strong> manual and guided diagrams.</li>
              </ul>
            </div>

            <MainMenuDiagram />

            <div className="about-subsection">
              <h3>Game Mode vs Experiment Mode</h3>
              <ul>
                <li><strong>Game Mode:</strong> clean UI for regular play, quick solve, and export.</li>
                <li>
                  <strong>Experiment Mode:</strong> exposes timeout and tuning controls (`nAnts`, `numACS`,
                  `q0`, `xi`, `rho`, `evap`, `convThresh`, `entropy %`).
                </li>
                <li>Use Experiment Mode when you want to compare solve behavior under different settings.</li>
              </ul>
            </div>

            <ExperimentModeDiagram />

            <div className="about-subsection">
              <h3>Solver controls and outputs</h3>
              <ul>
                <li><strong>Solve:</strong> starts algorithm execution for current puzzle state.</li>
                <li><strong>Stop:</strong> cancels an in-progress solve run.</li>
                <li><strong>Progress feedback:</strong> grid updates and status changes while solving.</li>
                <li><strong>Error toast:</strong> appears when solve fails or is canceled.</li>
              </ul>
            </div>

            <ExportDiagram />

            <div className="about-subsection">
              <h3>Autosave and persistence</h3>
              <ul>
                <li>In-progress game state auto-saves during active play and periodic intervals.</li>
                <li>Saved state includes grid, original puzzle, notes, size, difficulty, and timer.</li>
                <li>State is cleared on completion to avoid stale resume states.</li>
              </ul>
            </div>

            <div className="about-subsection">
              <h3>Troubleshooting FAQ</h3>
              <ul>
                <li><strong>Conflicts highlighted in red:</strong> verify duplicates in row, column, or box.</li>
                <li><strong>Upload rejected:</strong> confirm file is `.txt` and format matches expected schema.</li>
                <li><strong>No PDF button:</strong> appears only after a successful solver run.</li>
                <li><strong>Slow solve:</strong> reduce puzzle size or adjust timeout/parameters in Experiment Mode.</li>
                <li><strong>Unexpected puzzle state:</strong> open a new puzzle from modal to reset context.</li>
              </ul>
            </div>
          </section>
        )}

        <div className="flex gap-3 flex-wrap mt-6">
          <Link to="/" className="btn btn-secondary">Back To Main Menu</Link>
          <Link to="/game" className="btn btn-primary">Go To Game Mode</Link>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;

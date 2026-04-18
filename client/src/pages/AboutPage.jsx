import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AboutTabs from '../components/about/AboutTabs';
import { CoreRuleVisualCards, SolvingHabitVisualCards } from '../components/about/HowToPlayVisualCards';
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
          SudACO is a Sudoku web app powered by WebAssembly solvers. Use these tabs for Sudoku rules,
          app guidance, and project background.
        </p>

        <AboutTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'howToPlay' && (
          <section className="about-section">
            <h2>How to Play (Sudoku Rules)</h2>
            <p>
              Sudoku is a logic puzzle where each row, column, and box must contain every number exactly once.
            </p>

            <div className="about-subsection">
              <h3>Core rules</h3>
              <CoreRuleVisualCards />
            </div>

            <div className="about-subsection">
              <h3>Helpful solving habits</h3>
              <SolvingHabitVisualCards />
            </div>
          </section>
        )}

        {activeTab === 'userManual' && (
          <section className="about-section">
            <h2>User Manual</h2>
            <p>
              This manual explains how to use the SudACO application and all available features.
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
              <h3>Play workflow</h3>
              <ul>
                <li>Open puzzle sources from the modal (Daily, Library, Upload, or My Puzzles).</li>
                <li>Fill values using keyboard or Number Pad; use Notes mode for candidates.</li>
                <li>Use <strong>Undo</strong> to revert user edits in both Game and Experiment modes.</li>
                <li>Press <strong>Solve</strong> to run the solver and watch progress updates.</li>
              </ul>
            </div>

            <GameModeDiagram />
            <ExperimentModeDiagram />
            <PuzzleModalDiagram />

            <ExportDiagram />

            <div className="about-subsection">
              <h3>Download and export</h3>
              <ul>
                <li>Use one <strong>Download</strong> button to choose puzzle target and file format.</li>
                <li>Available targets: <strong>Initial Grid</strong> and <strong>Solved Sudoku Puzzle</strong>.</li>
                <li>Available formats: <strong>.txt</strong> (instance format) and <strong>.pdf</strong> (grid report).</li>
              </ul>
            </div>

            <div className="about-subsection">
              <h3>Autosave and persistence</h3>
              <ul>
                <li>In-progress game state auto-saves during active play and periodic intervals.</li>
                <li>Saved state includes grid, original puzzle, notes, size, and timer.</li>
                <li>State is cleared on completion to avoid stale resume states.</li>
              </ul>
            </div>

            <div className="about-subsection">
              <h3>Troubleshooting FAQ</h3>
              <ul>
                <li><strong>Conflicts highlighted in red:</strong> verify duplicates in row, column, or box.</li>
                <li><strong>Upload rejected:</strong> confirm file is `.txt` and format matches expected schema.</li>
                <li><strong>Slow solve:</strong> reduce puzzle size or adjust timeout/parameters in Experiment Mode.</li>
                <li><strong>Unexpected puzzle state:</strong> open a new puzzle from modal to reset context.</li>
              </ul>
            </div>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="about-section">
            <div className="about-subsection">
              <h3>About</h3>
              <p>
                SudACO is a Sudoku web app that blends classic puzzle gameplay with smart solving technology.
                It&apos;s powered by a research-based system that uses multiple &quot;ant colonies&quot; working together
                to solve puzzles efficiently.
              </p>
              <p>
                Instead of just giving you the answer, the app lets you explore how intelligent algorithms approach
                Sudoku—making it both fun to play and interesting to observe.
              </p>
            </div>

            <hr className="my-1 border-0 border-t border-slate-500/25" />

            <div className="about-subsection">
              <h3>What this game is about</h3>
              <p>
                At its core, SudACO is still the Sudoku you know—fill the grid so each number appears once per row,
                column, and box.
              </p>
              <p>But here&apos;s the twist 👇</p>
              <p>
                You&apos;re not just playing… you&apos;re also seeing how an advanced solver works behind the scenes.
              </p>
              <p>The system:</p>
              <ul>
                <li>Uses logic rules to simplify the puzzle</li>
                <li>Simulates multiple groups of agents (&quot;ants&quot;) exploring solutions</li>
                <li>Balances trying new possibilities and improving good ones</li>
                <li>Lets different groups share information to solve puzzles faster</li>
              </ul>
              <p>
                So whether you&apos;re solving it yourself or watching the solver in action, you&apos;re experiencing
                how cooperative AI tackles complex problems.
              </p>
            </div>

            <hr className="my-1 border-0 border-t border-slate-500/25" />

            <div className="about-subsection">
              <h3>Who made it</h3>
              <p>
                <strong>Gian Myrl D. Renomeron</strong>
                <br />
                BS Computer Science
                <br />
                University of the Philippines Tacloban College
              </p>
              <p>
                <strong>Adviser:</strong> Dr. John Paul T. Yusiong
              </p>
              <p>
                This project is part of a research study focused on applying cooperative swarm intelligence to Sudoku
                solving and making it accessible through an interactive web app.
              </p>
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

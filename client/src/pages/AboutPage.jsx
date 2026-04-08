import React from 'react';
import { Link } from 'react-router-dom';

function AboutPage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto card">
        <h1 className="text-3xl font-bold text-gradient mb-4">About Game</h1>
        <p className="text-[var(--color-text-secondary)] mb-6">
          SudACO is a Sudoku web application powered by WebAssembly solvers. You can play manually,
          solve automatically, and explore different solving modes.
        </p>

        <h2 className="text-xl font-semibold mb-2">Main Features</h2>
        <ul className="list-disc pl-6 text-[var(--color-text-secondary)] space-y-1 mb-6">
          <li>Interactive Sudoku gameplay with notes, highlights, and keyboard support.</li>
          <li>Puzzle sources: daily, library, upload, and generated puzzles.</li>
          <li>Multiple algorithms with tunable parameters in Experiment Mode.</li>
        </ul>

        <h2 className="text-xl font-semibold mb-2">How To Play (Game Mode)</h2>
        <ul className="list-disc pl-6 text-[var(--color-text-secondary)] space-y-1 mb-6">
          <li>Open a puzzle using the <strong>Choose Puzzle</strong> button.</li>
          <li>Fill cells using the number pad; use Notes mode for candidates.</li>
          <li>Press <strong>Solve</strong> to run default-parameter solving.</li>
          <li>Press <strong>Stop</strong> while solving to terminate solving immediately.</li>
          <li>After solver success, use <strong>Download PDF</strong> to export original vs solved puzzle and parameters.</li>
        </ul>

        <h2 className="text-xl font-semibold mb-2">Modes</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          <strong>Game Mode</strong> focuses on streamlined gameplay. <strong>Experiment Mode</strong> adds a side panel
          for parameter tuning and quick puzzle/library controls.
        </p>

        <div className="flex gap-3 flex-wrap">
          <Link to="/" className="btn btn-secondary">Back To Main Menu</Link>
          <Link to="/game" className="btn btn-primary">Go To Game Mode</Link>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;

import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';

const CALLOUTS = [
  {
    id: 1,
    label: 'Export actions',
    description: 'Download Puzzle (.txt) is always available; PDF appears after solve.',
    position: { top: '14%', left: '36%' }
  },
  {
    id: 2,
    label: 'Solved grid + report data',
    description: 'Solved board is used to build the final PDF report.',
    position: { top: '38%', left: '34%' }
  },
  {
    id: 3,
    label: 'Puzzle TXT instance sample',
    description: 'Shows the upload/export instance format with order, metadata, and grid rows.',
    position: { top: '56%', left: '30%' }
  },
  {
    id: 4,
    label: 'PDF report format',
    description: 'Shows title, metadata, original/solved boards, and parameter values.',
    position: { top: '73%', left: '50%' }
  }
];

function ExportDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const [solverFinished, setSolverFinished] = useState(false);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Export and Output Guide"
      description="Both exports are available from Game Mode; PDF appears after a solved run."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
      showCanvasCallouts={false}
    >
      <div className={`about-mock about-mock-export ${activeClass}`}>
        <div className="export-actions region-1">
          <span className="exp-btn">Download Puzzle (.txt)</span>
          <span className={`exp-btn primary ${solverFinished ? '' : 'is-disabled'}`}>Download PDF</span>
        </div>

        <div className="export-preview region-2">
          <div className="preview-grid mini-grid board" />
          <div className="preview-grid mini-grid board solved" />
        </div>

        <div className="export-txt region-3">
          <span className="txt-title">Puzzle TXT instance sample</span>
          <pre>{`3
1
9 8 -1 7 -1 -1 6 -1 -1
7 -1 -1 5 -1 -1 9 -1 -1
-1 -1 4 -1 -1 -1 -1 3 -1
...`}</pre>
        </div>

        <div className="export-pdf region-4">
          <div className="pdf-header">
            <strong>SudACO - Solved Puzzle Report</strong>
            <span>Generated: 4/9/2026, 5:40:06 PM</span>
            <span>Size: 9x9 | Difficulty: hard | Algorithm: Multi-Colony DCM-ACO</span>
          </div>
          <div className="pdf-grids">
            <div className="pdf-grid">
              <em>Original Puzzle</em>
              <div className="mini-grid white" />
            </div>
            <div className="pdf-grid">
              <em>Solved Puzzle</em>
              <div className="mini-grid white" />
            </div>
          </div>
          <div className="pdf-params">
            <em>Parameter Values Used</em>
            <span>nAnts: 3 • numColonies: 7 • numACS: 6 • q0: 0.9 • rho: 0.9</span>
          </div>
        </div>

        <div className="about-mock-toggles">
          <button type="button" onClick={() => setSolverFinished((v) => !v)}>
            {solverFinished ? 'Solver: Finished' : 'Solver: Not Finished'}
          </button>
        </div>
      </div>
    </AboutDiagram>
  );
}

export default ExportDiagram;

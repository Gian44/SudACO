import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';

const CALLOUTS = [
  {
    id: 1,
    label: 'Single download action',
    description: 'One Download button opens options for target (initial/solved) and format (.txt/.pdf).',
    position: { top: '14%', left: '36%' }
  },
  {
    id: 2,
    label: 'Target preview',
    description: 'Initial and current/solved puzzle states are available for export selection.',
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
    description: 'Shows initial and selected puzzle grids; fixed clues are bold in the second grid.',
    position: { top: '73%', left: '50%' }
  }
];

function ExportDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Export and Output Guide"
      description="Download options are available in Game and Experiment modes at any time."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
      showCanvasCallouts={false}
    >
      <div className={`about-mock about-mock-export ${activeClass}`}>
        <div className="export-actions region-1">
          <span className="exp-btn primary">Download</span>
          <span className="exp-btn">Target + Format Modal</span>
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
            <strong>SudACO - Puzzle Report</strong>
            <span>Generated: 4/9/2026, 5:40:06 PM</span>
            <span>Size: 9x9 | Algorithm: Multi-Colony DCM-ACO</span>
          </div>
          <div className="pdf-grids">
            <div className="pdf-grid">
              <em>Initial Puzzle</em>
              <div className="mini-grid white" />
            </div>
            <div className="pdf-grid">
              <em>Solved Puzzle (fixed clues in bold)</em>
              <div className="mini-grid white" />
            </div>
          </div>
          <div className="pdf-params">
            <em>Parameter Values Used</em>
            <span>nAnts: 3 • numColonies: 7 • numACS: 6 • q0: 0.9 • rho: 0.9</span>
          </div>
        </div>

      </div>
    </AboutDiagram>
  );
}

export default ExportDiagram;

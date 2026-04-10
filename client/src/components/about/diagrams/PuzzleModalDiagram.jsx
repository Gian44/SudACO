import React, { useMemo, useState } from 'react';
import AboutDiagram from '../AboutDiagram';

const CALLOUTS = [
  {
    id: 1,
    label: 'Source tabs',
    description: 'Switch between Daily, Library, Upload, and My Puzzles.',
    position: { top: '17%', left: '24%' }
  },
  {
    id: 2,
    label: 'Tab content area',
    description: 'Main section updates to match the selected puzzle source tab.',
    position: { top: '45%', left: '22%' }
  },
  {
    id: 3,
    label: 'Primary source action',
    description: 'Daily challenge card, library rows, upload zone, or My Puzzles panel.',
    position: { top: '53%', left: '65%' }
  },
  {
    id: 4,
    label: 'Footer controls',
    description: 'Calendar/pagination hints and supporting instructions.',
    position: { top: '84%', left: '63%' }
  }
];

function PuzzleModalDiagram() {
  const [activeId, setActiveId] = useState(CALLOUTS[0].id);
  const [activeTab, setActiveTab] = useState('daily');
  const activeClass = useMemo(() => `active-${activeId}`, [activeId]);

  return (
    <AboutDiagram
      title="Puzzle Selection Modal"
      description="This is where most sessions start in both Game and Experiment modes."
      callouts={CALLOUTS}
      activeId={activeId}
      onActivate={setActiveId}
      showCanvasCallouts={false}
    >
      <div className={`about-mock about-mock-modal ${activeClass}`}>
        <div className={`modal-shell modal-shell-${activeTab}`}>
          <div className="modal-top">
            <strong>Select Puzzle</strong>
            <span className="close-x">x</span>
          </div>
          <div className="modal-tabs region-1">
            {[
              { id: 'daily', label: 'Daily' },
              { id: 'library', label: 'Library' },
              { id: 'upload', label: 'Upload' },
              { id: 'mypuzzles', label: 'My puzzles' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'daily' && (
            <div className={`modal-pane modal-pane-${activeTab} region-2`}>
              <p className="modal-help">Play today&apos;s daily puzzle! A new random puzzle is generated each day.</p>
              <div className="daily-card region-3">
                <div className="daily-main">
                  <span className="badge">Today&apos;s Challenge</span>
                  <span className="meta">Thursday, April 9</span>
                </div>
                <div className="daily-tags">
                  <span>9x9</span>
                  <span className="hard">HARD ★★★★</span>
                </div>
              </div>
              <div className="daily-play region-3">Play Daily Puzzle</div>
              <div className="daily-calendar region-4">
                <span className="cal-title">Daily Puzzles Calendar</span>
                <div className="mini-calendar" />
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div className={`modal-pane modal-pane-${activeTab} region-2`}>
              <p className="modal-label">Category</p>
              <div className="library-select">9x9</div>
              <div className="library-list region-3">
                {['2020_00004.txt', '2020_00021.txt', '2020_00041.txt', '2020_00049.txt', '2020_00054.txt'].map((item) => (
                  <span key={item} className="library-row">{item}</span>
                ))}
              </div>
              <div className="library-footer region-4">
                <span>Showing 1-50 of 100 puzzles</span>
                <span className="pager">Previous | Page 1 of 2 | Next</span>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className={`modal-pane modal-pane-${activeTab} region-2`}>
              <p className="modal-help">Upload a custom puzzle file in .txt format.</p>
              <div className="upload-box region-3">
                <span>Drop your puzzle file here</span>
                <em>or click to browse</em>
              </div>
            </div>
          )}

          {activeTab === 'mypuzzles' && (
            <div className={`modal-pane modal-pane-${activeTab} region-2`}>
              <p className="modal-help">Puzzles you created and saved. Stored in this browser only.</p>
              <div className="mypuzzles-empty region-3">No puzzles yet. Create one in the Create tab.</div>
            </div>
          )}
        </div>
      </div>
    </AboutDiagram>
  );
}

export default PuzzleModalDiagram;

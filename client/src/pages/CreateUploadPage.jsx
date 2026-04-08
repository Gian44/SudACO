import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SudokuGrid from '../components/SudokuGrid';
import NumberPad from '../components/NumberPad';
import {
  createEmptyGrid,
  createEmptyNotesGrid,
  findConflicts,
  gridToString,
  stringToGrid,
  validateGrid
} from '../utils/sudokuUtils';
import { calculateDifficulty } from '../utils/dailyPuzzleService';
import { saveUserCreatedPuzzle } from '../utils/userCreatedPuzzles';
import { parseInstanceFile, getInstanceFileFormatDescription } from '../utils/fileParser';
import { generatePuzzle } from '../utils/puzzleGenerator';
import { getDefaultParameters } from '../utils/wasmBridge';

function CreateUploadPage({ tab }) {
  const navigate = useNavigate();
  const title = tab === 'create' ? 'Create Puzzle' : 'Upload Puzzle';
  const [error, setError] = useState('');

  // Create page state
  const [createMode, setCreateMode] = useState('manual');
  const [createSize, setCreateSize] = useState(9);
  const [grid, setGrid] = useState(() => createEmptyGrid(9));
  const [selectedCell, setSelectedCell] = useState(null);
  const [notesMode, setNotesMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPuzzle, setGeneratedPuzzle] = useState(null);
  const [createAlgorithm, setCreateAlgorithm] = useState(2);

  // Upload page state
  const [dragOver, setDragOver] = useState(false);

  const resetCreateGrid = useCallback((size) => {
    setCreateSize(size);
    setGrid(createEmptyGrid(size));
    setSelectedCell(null);
    setNotesMode(false);
    setGeneratedPuzzle(null);
    setError('');
  }, []);

  const handleCellChange = useCallback((row, col, value) => {
    setGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
  }, []);

  const handleNumberClick = useCallback((num) => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;
    handleCellChange(row, col, String(num));
  }, [handleCellChange, selectedCell]);

  const handleDelete = useCallback(() => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;
    handleCellChange(row, col, '');
  }, [handleCellChange, selectedCell]);

  const createPuzzleFromGrid = useCallback((nextGrid, size, sourceLabel = 'created') => {
    const formatValidation = validateGrid(nextGrid, size);
    if (!formatValidation.isValid) {
      setError(formatValidation.errors[0] || 'Invalid puzzle format.');
      return;
    }
    const conflicts = findConflicts(nextGrid, size);
    if (conflicts.size > 0) {
      setError('Puzzle has row/column/box conflicts. Please fix before playing.');
      return;
    }
    const filled = nextGrid.flat().filter((cell) => cell !== '').length;
    if (filled === 0) {
      setError('Please add at least one given number before playing.');
      return;
    }

    const puzzleString = gridToString(nextGrid, size);
    const difficulty = calculateDifficulty(puzzleString, size);
    const entry = saveUserCreatedPuzzle({ size, puzzleString, difficulty });
    navigate('/game', {
      state: {
        initialPuzzleData: {
          grid: nextGrid.map((r) => [...r]),
          size,
          puzzleString,
          difficulty,
          isDaily: false,
          source: sourceLabel,
          puzzleKey: `my-${entry.id}`
        }
      }
    });
  }, [navigate]);

  const handleManualPlay = useCallback(() => {
    createPuzzleFromGrid(grid, createSize, 'manual-create');
  }, [createPuzzleFromGrid, createSize, grid]);

  const handleGeneratePuzzle = useCallback(async () => {
    setError('');
    setGeneratedPuzzle(null);
    setIsGenerating(true);
    try {
      const randomFill = [35, 45, 55][Math.floor(Math.random() * 3)];
      const params = getDefaultParameters(createSize)[createAlgorithm];
      const result = await generatePuzzle(createSize, createAlgorithm, randomFill, params, null);
      if (!result.success) throw new Error(result.error || 'Generation failed');
      const generatedGrid = stringToGrid(result.puzzleString, createSize);
      setGeneratedPuzzle(generatedGrid);
    } catch (err) {
      setError(err.message || 'Failed to generate puzzle');
    } finally {
      setIsGenerating(false);
    }
  }, [createAlgorithm, createSize]);

  const handleUploadFile = useCallback(async (file) => {
    setError('');
    try {
      const content = await file.text();
      const { size, puzzleString } = parseInstanceFile(content);
      if (![9, 16, 25].includes(size)) {
        setError(`Only 9x9, 16x16, and 25x25 are supported. Uploaded: ${size}x${size}.`);
        return;
      }
      const uploadedGrid = stringToGrid(puzzleString, size);
      const difficulty = calculateDifficulty(puzzleString, size);
      const entry = saveUserCreatedPuzzle({ size, puzzleString, difficulty });
      navigate('/game', {
        state: {
          initialPuzzleData: {
            grid: uploadedGrid,
            size,
            puzzleString,
            difficulty,
            isDaily: false,
            source: 'upload',
            puzzleKey: `my-${entry.id}`
          }
        }
      });
    } catch (err) {
      setError(`Invalid file format: ${err.message}`);
    }
  }, [navigate]);

  const createContent = (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          className={`btn ${createMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCreateMode('manual')}
        >
          Manual Entry
        </button>
        <button
          type="button"
          className={`btn ${createMode === 'generate' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCreateMode('generate')}
        >
          Generate By Algorithm
        </button>
      </div>

      {createMode === 'manual' ? (
        <>
          <div className="mb-3">
            <label className="block text-sm mb-1">Puzzle Size</label>
            <select
              value={createSize}
              onChange={(e) => resetCreateGrid(Number(e.target.value))}
              className="select w-full sm:w-60"
            >
              {[9, 16, 25].map((s) => <option key={s} value={s}>{s}x{s}</option>)}
            </select>
          </div>
          <div className="flex justify-center">
            <SudokuGrid
              grid={grid}
              onChange={handleCellChange}
              size={createSize}
              readOnly={false}
              originalGrid={createEmptyGrid(createSize)}
              notes={createEmptyNotesGrid(createSize)}
              onNotesChange={() => {}}
              notesMode={notesMode}
              selectedCell={selectedCell}
              onCellSelect={setSelectedCell}
              animatingCells={new Set()}
              isPaused={false}
            />
          </div>
          <NumberPad
            size={createSize}
            onNumberClick={handleNumberClick}
            onDelete={handleDelete}
            onAction={handleManualPlay}
            actionLabel="Play Created Puzzle"
            actionClassName="btn btn-primary"
            notesMode={notesMode}
            onToggleNotes={() => setNotesMode((prev) => !prev)}
            grid={grid}
            disabled={false}
          />
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Secondary option: generate a puzzle through the algorithm.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Size</label>
              <select className="select w-full" value={createSize} onChange={(e) => setCreateSize(Number(e.target.value))}>
                {[9, 16, 25].map((s) => <option key={s} value={s}>{s}x{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Algorithm</label>
              <select className="select w-full" value={createAlgorithm} onChange={(e) => setCreateAlgorithm(Number(e.target.value))}>
                <option value={2}>Multi-Colony DCM-ACO</option>
              </select>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleGeneratePuzzle} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Puzzle'}
          </button>
          {generatedPuzzle && (
            <div className="space-y-3">
              <div className="text-sm text-[var(--color-text-secondary)]">Generated puzzle preview:</div>
              <div className="flex justify-center">
                <SudokuGrid
                  grid={generatedPuzzle}
                  onChange={() => {}}
                  size={createSize}
                  readOnly
                  originalGrid={generatedPuzzle}
                  notes={createEmptyNotesGrid(createSize)}
                  onNotesChange={() => {}}
                  notesMode={false}
                  selectedCell={null}
                  onCellSelect={() => {}}
                  animatingCells={new Set()}
                  isPaused={false}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => createPuzzleFromGrid(generatedPuzzle, createSize, 'generated-create')}
              >
                Play Generated Puzzle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const uploadContent = (
    <div className="card">
      <p className="text-sm text-[var(--color-text-secondary)] mb-3">
        Upload a puzzle file. After upload, it opens directly in Game Mode.
      </p>
      <div
        className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file && file.name.endsWith('.txt')) {
            handleUploadFile(file);
          } else {
            setError('Please upload a .txt file');
          }
        }}
        onClick={() => document.getElementById('upload-file-input')?.click()}
      >
        <p className="text-base font-medium mb-1">Drop your puzzle file here</p>
        <p className="text-sm text-[var(--color-text-muted)]">or click to browse</p>
        <input
          id="upload-file-input"
          type="file"
          accept=".txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadFile(file);
          }}
        />
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-[var(--color-text-secondary)]">Expected file format</summary>
        <pre className="mt-2 text-xs p-3 rounded bg-[var(--color-bg-secondary)] overflow-x-auto">
          {getInstanceFileFormatDescription()}
        </pre>
      </details>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{title}</h1>
          <Link to="/" className="btn btn-secondary">Main Menu</Link>
        </div>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-error)]/20 border border-[var(--color-error)]/50 text-[var(--color-error)]">
            {error}
          </div>
        )}
        {tab === 'create' ? createContent : uploadContent}
      </div>
    </div>
  );
}

export default CreateUploadPage;

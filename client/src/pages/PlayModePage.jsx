import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  clearCellNotes,
  createEmptyGrid,
  createEmptyNotesGrid,
  gridToString,
  isPuzzleSolved,
  removeNoteFromRelatedCells,
  stringToGrid
} from '../utils/sudokuUtils';
import {
  clearGameState,
  isStateValid,
  loadGameState,
  restoreGameState,
  saveGameState
} from '../utils/gameStatePersistence';
import { loadRandomLibraryPuzzle } from '../utils/randomPuzzleLoader';
import {
  getAlgorithmNames,
  getDefaultParameters,
  solveSudoku
} from '../utils/wasmBridge';
import { createSolverWorkerRunner } from '../utils/solverWorkerClient';
import { downloadSolvedPuzzlePdf } from '../utils/gamePdfExport';
import LoadingScreen from '../components/LoadingScreen';
import GameHeader from '../components/GameHeader';
import SudokuGrid from '../components/SudokuGrid';
import NumberPad from '../components/NumberPad';
import PuzzleSelectionModal from '../components/PuzzleSelectionModal';
import CompletionModal from '../components/CompletionModal';

const ANIMATION_SPEEDS = { fast: 20, medium: 50, slow: 100 };

function PlayModePage({ mode }) {
  const isGameMode = mode === 'game';
  const location = useLocation();
  const algorithmNames = getAlgorithmNames();
  const workerRunnerRef = useRef(null);
  const timerRef = useRef(0);
  const saveTimeoutRef = useRef(null);

  const [grid, setGrid] = useState(() => createEmptyGrid(9));
  const [size, setSize] = useState(9);
  const [originalGrid, setOriginalGrid] = useState(null);
  const [notes, setNotes] = useState(() => createEmptyNotesGrid(9));
  const [notesMode, setNotesMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [isDaily, setIsDaily] = useState(false);
  const [puzzleKey, setPuzzleKey] = useState(null);
  const [initialTimerSeconds, setInitialTimerSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading puzzle...');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showPuzzleModal, setShowPuzzleModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [wasAlgorithmSolved, setWasAlgorithmSolved] = useState(false);
  const [animatingCells, setAnimatingCells] = useState(new Set());
  const [error, setError] = useState('');
  const [algorithmSolveTime, setAlgorithmSolveTime] = useState(null);
  const [isSolving, setIsSolving] = useState(false);
  const [lastSolveMeta, setLastSolveMeta] = useState(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(2);
  const [animationSpeed, setAnimationSpeed] = useState('medium');
  const [solverParams, setSolverParams] = useState(() => getDefaultParameters(9)[2]);

  useEffect(() => {
    setSolverParams(getDefaultParameters(size)[selectedAlgorithm]);
  }, [size, selectedAlgorithm]);

  const resetTransientState = useCallback(() => {
    setSelectedCell(null);
    setNotesMode(false);
    setWasAlgorithmSolved(false);
    setShowCompletionModal(false);
    setError('');
    setAlgorithmSolveTime(null);
    setLastSolveMeta(null);
  }, []);

  const handlePuzzleSelect = useCallback((puzzleData) => {
    const { grid: newGrid, size: newSize, difficulty: newDifficulty, isDaily: newIsDaily, puzzleKey: newPuzzleKey } = puzzleData;
    setGrid(newGrid);
    setSize(newSize);
    setOriginalGrid(newGrid.map((row) => [...row]));
    setNotes(createEmptyNotesGrid(newSize));
    setDifficulty(newDifficulty);
    setIsDaily(newIsDaily);
    setPuzzleKey(newPuzzleKey || `puzzle-${Date.now()}`);
    setInitialTimerSeconds(0);
    setIsPlaying(true);
    setIsPaused(false);
    resetTransientState();
  }, [resetTransientState]);

  useEffect(() => {
    let mounted = true;
    const initialPuzzle = location.state?.initialPuzzleData;

    const loadInitialPuzzle = async () => {
      setIsLoading(true);
      try {
        if (initialPuzzle) {
          handlePuzzleSelect(initialPuzzle);
          return;
        }
        const savedState = loadGameState();
        if (savedState && isStateValid(savedState)) {
          const restored = restoreGameState(savedState);
          if (restored && mounted) {
            setGrid(restored.grid);
            setSize(restored.size);
            setOriginalGrid(restored.originalGrid);
            setNotes(restored.notes);
            setDifficulty(restored.difficulty);
            setIsDaily(restored.isDaily);
            setPuzzleKey(restored.puzzleKey);
            setInitialTimerSeconds(restored.timerSeconds);
            setIsPlaying(true);
            setIsLoading(false);
            return;
          }
        }

        setLoadingMessage('Loading random puzzle...');
        const puzzleData = await loadRandomLibraryPuzzle();
        if (!mounted) return;
        if (puzzleData) {
          handlePuzzleSelect(puzzleData);
        } else {
          setShowPuzzleModal(true);
        }
      } catch (err) {
        console.error('Failed to load initial puzzle', err);
        if (mounted) {
          setShowPuzzleModal(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialPuzzle();
    return () => { mounted = false; };
  }, [handlePuzzleSelect, location.state]);

  const handleCellChange = useCallback((row, col, value) => {
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((r) => [...r]);
      newGrid[row][col] = value;
      return newGrid;
    });
    if (value !== '') {
      setNotes((prevNotes) => {
        let newNotes = clearCellNotes(prevNotes, row, col);
        newNotes = removeNoteFromRelatedCells(newNotes, row, col, parseInt(value, 10), size);
        return newNotes;
      });
    }
  }, [size]);

  const handleNumberClick = useCallback((num) => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;
    if (originalGrid && originalGrid[row][col] !== '') return;
    if (notesMode) {
      setNotes((prevNotes) => {
        const newNotes = prevNotes.map((r) => r.map((c) => new Set(c)));
        if (newNotes[row][col].has(num)) newNotes[row][col].delete(num);
        else newNotes[row][col].add(num);
        return newNotes;
      });
    } else {
      handleCellChange(row, col, String(num));
    }
  }, [selectedCell, originalGrid, notesMode, handleCellChange]);

  const handleDelete = useCallback(() => {
    if (!selectedCell) return;
    const [row, col] = selectedCell;
    if (originalGrid && originalGrid[row][col] !== '') return;
    if (notesMode) {
      setNotes((prevNotes) => clearCellNotes(prevNotes, row, col));
    } else {
      handleCellChange(row, col, '');
    }
  }, [selectedCell, originalGrid, notesMode, handleCellChange]);

  const handleSolutionStep = useCallback((row, col, value) => {
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((r) => [...r]);
      newGrid[row][col] = value;
      return newGrid;
    });
    setAnimatingCells((prev) => new Set([...prev, `${row}-${col}`]));
    setTimeout(() => {
      setAnimatingCells((prev) => {
        const next = new Set(prev);
        next.delete(`${row}-${col}`);
        return next;
      });
    }, 300);
  }, []);

  const animateSolution = useCallback(async (solution, originalPuzzleString) => {
    const solvedGrid = stringToGrid(solution, size);
    const startGrid = stringToGrid(originalPuzzleString, size);
    const delay = ANIMATION_SPEEDS[animationSpeed] || ANIMATION_SPEEDS.medium;
    const cells = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (startGrid[row][col] === '' && solvedGrid[row][col] !== '') {
          cells.push({ row, col, value: solvedGrid[row][col] });
        }
      }
    }
    for (let i = cells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (const cell of cells) {
      handleSolutionStep(cell.row, cell.col, cell.value);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }, [animationSpeed, handleSolutionStep, size]);

  const finalizeSolveResult = useCallback(async (result, algorithm, params, puzzleString) => {
    if (result?.success && result.solution) {
      setWasAlgorithmSolved(true);
      const ms = result.time != null ? result.time * 1000 : null;
      if (ms != null) setAlgorithmSolveTime(ms);
      await animateSolution(result.solution, puzzleString);
      setLastSolveMeta({
        algorithm,
        algorithmName: algorithmNames[algorithm],
        params,
        originalGrid: (originalGrid || grid).map((row) => [...row]),
        solvedGrid: stringToGrid(result.solution, size),
        solvedAt: Date.now()
      });
      setTimeout(() => {
        setShowCompletionModal(true);
        setIsPlaying(false);
      }, 300);
    } else {
      setAlgorithmSolveTime(null);
      setError(result?.error || 'Puzzle not solved.');
      setIsPaused(false);
    }
  }, [algorithmNames, animateSolution, grid, originalGrid, size]);

  const runExperimentSolve = useCallback(async () => {
    if (!originalGrid || isSolving) return;
    setIsSolving(true);
    setError('');
    setIsPaused(true);
    const puzzleString = gridToString(originalGrid, size);
    const paramsSnapshot = { ...solverParams };
    try {
      const result = await solveSudoku(puzzleString, selectedAlgorithm, paramsSnapshot);
      await finalizeSolveResult(result, selectedAlgorithm, paramsSnapshot, puzzleString);
    } catch (err) {
      setError(`Solving failed: ${err.message}`);
      setIsPaused(false);
    } finally {
      setIsSolving(false);
    }
  }, [finalizeSolveResult, isSolving, originalGrid, selectedAlgorithm, size, solverParams]);

  const runGameSolve = useCallback(async () => {
    if (!originalGrid || isSolving) return;
    setError('');
    setIsPaused(true);
    setIsSolving(true);
    const puzzleString = gridToString(originalGrid, size);
    const defaultParams = getDefaultParameters(size)[2];
    setSelectedAlgorithm(2);
    if (!workerRunnerRef.current) {
      workerRunnerRef.current = createSolverWorkerRunner();
    }
    const result = await workerRunnerRef.current.start(puzzleString, 2, defaultParams);
    await finalizeSolveResult(result, 2, defaultParams, puzzleString);
    setIsSolving(false);
  }, [finalizeSolveResult, isSolving, originalGrid, size]);

  const stopGameSolve = useCallback(() => {
    workerRunnerRef.current?.stop();
    setIsSolving(false);
    setIsPaused(false);
    setAlgorithmSolveTime(null);
    setError('Solving stopped. Puzzle not solved.');
  }, []);

  useEffect(() => () => {
    workerRunnerRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (isPlaying && originalGrid && !showCompletionModal && isPuzzleSolved(grid, size)) {
      clearGameState();
      setShowCompletionModal(true);
      setIsPlaying(false);
    }
  }, [grid, isPlaying, originalGrid, showCompletionModal, size]);

  const persistState = useCallback(() => {
    if (!puzzleKey || !originalGrid || !isPlaying || showCompletionModal) return;
    saveGameState({
      puzzleKey,
      grid,
      originalGrid,
      notes,
      size,
      difficulty,
      isDaily,
      timerSeconds: timerRef.current ?? 0
    });
  }, [difficulty, grid, isDaily, isPlaying, notes, originalGrid, puzzleKey, showCompletionModal, size]);

  useEffect(() => {
    if (!puzzleKey || !isPlaying || showCompletionModal) return;
    saveTimeoutRef.current = setTimeout(persistState, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [grid, notes, puzzleKey, isPlaying, showCompletionModal, persistState]);

  useEffect(() => {
    if (!isPlaying || !puzzleKey) return;
    const interval = setInterval(persistState, 30000);
    return () => clearInterval(interval);
  }, [isPlaying, persistState, puzzleKey]);

  const startSolve = isGameMode ? runGameSolve : runExperimentSolve;

  const gameControls = (
    <div className="flex items-center gap-2 flex-wrap justify-center mt-3">
      <button type="button" className="btn btn-secondary" onClick={() => setShowPuzzleModal(true)} disabled={isSolving}>
        Choose Puzzle
      </button>
      <button type="button" className="btn btn-primary" onClick={startSolve} disabled={isSolving || !originalGrid}>
        Solve
      </button>
      {isGameMode && isSolving && (
        <button type="button" className="btn btn-danger" onClick={stopGameSolve}>
          Stop
        </button>
      )}
      {isGameMode && lastSolveMeta?.solvedGrid && (
        <button
          type="button"
          className="btn btn-success"
          onClick={() => downloadSolvedPuzzlePdf({
            originalGrid: lastSolveMeta.originalGrid,
            solvedGrid: lastSolveMeta.solvedGrid,
            size,
            difficulty,
            algorithmName: lastSolveMeta.algorithmName,
            params: lastSolveMeta.params
          })}
        >
          Download PDF
        </button>
      )}
    </div>
  );

  const experimentPanel = (
    <aside className="card w-full lg:w-[350px] self-start">
      <h3 className="text-lg font-semibold mb-3">Experiment Controls</h3>
      <button type="button" className="btn btn-secondary w-full mb-3" onClick={() => setShowPuzzleModal(true)} disabled={isSolving}>
        Open Puzzle Library
      </button>
      <label className="block text-sm mb-1">Algorithm</label>
      <select
        className="select w-full mb-3"
        value={selectedAlgorithm}
        onChange={(e) => setSelectedAlgorithm(Number(e.target.value))}
        disabled={isSolving}
      >
        {[1, 0, 2].map((algo) => (
          <option key={algo} value={algo}>{algorithmNames[algo]}</option>
        ))}
      </select>

      <label className="block text-sm mb-1">Timeout (sec)</label>
      <input
        className="input mb-3"
        type="number"
        min="1"
        max="300"
        value={solverParams.timeout ?? 10}
        onChange={(e) => setSolverParams((prev) => ({ ...prev, timeout: Number(e.target.value) }))}
        disabled={isSolving}
      />

      {(selectedAlgorithm === 0 || selectedAlgorithm === 2) && (
        <>
          <label className="block text-sm mb-1">Number of Ants</label>
          <input
            className="input mb-3"
            type="number"
            min="1"
            max="50"
            value={solverParams.nAnts ?? 4}
            onChange={(e) => setSolverParams((prev) => ({ ...prev, nAnts: Number(e.target.value) }))}
            disabled={isSolving}
          />
        </>
      )}

      <label className="block text-sm mb-1">Animation Speed</label>
      <select className="select w-full mb-4" value={animationSpeed} onChange={(e) => setAnimationSpeed(e.target.value)} disabled={isSolving}>
        <option value="fast">Fast</option>
        <option value="medium">Medium</option>
        <option value="slow">Slow</option>
      </select>

      <button type="button" className="btn btn-primary w-full" onClick={startSolve} disabled={isSolving || !originalGrid}>
        {isSolving ? 'Solving...' : 'Solve'}
      </button>
    </aside>
  );

  if (isLoading) {
    return <LoadingScreen message={loadingMessage} subMessage="This may take a moment..." />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-2 sm:px-4 py-3 sm:py-6 w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-6xl flex justify-between mb-2 px-2">
        <h1 className="text-sm text-[var(--color-text-muted)]">{isGameMode ? 'GAME MODE' : 'EXPERIMENT MODE'}</h1>
        <Link to="/" className="btn btn-secondary text-xs">Main Menu</Link>
      </div>

      <GameHeader
        key={puzzleKey || 'no-puzzle'}
        isPlaying={isPlaying}
        isPaused={isPaused}
        difficulty={difficulty}
        puzzleSize={size}
        onNewPuzzle={() => { setShowPuzzleModal(true); if (isPlaying) setIsPaused(true); }}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        timerRef={timerRef}
        isDaily={isDaily}
        algorithmSolveTime={algorithmSolveTime}
        initialSeconds={initialTimerSeconds}
      />

      {gameControls}

      <main className={`flex w-full max-w-6xl gap-4 mt-3 ${isGameMode ? 'justify-center' : 'flex-col lg:flex-row items-center lg:items-start'}`}>
        <div className="flex-1 w-full flex flex-col items-center">
          <div className="relative w-full flex justify-center px-2 sm:px-4">
            <div className="w-full max-w-full overflow-x-auto">
              <SudokuGrid
                grid={grid}
                onChange={handleCellChange}
                size={size}
                readOnly={!isPlaying || showCompletionModal}
                originalGrid={originalGrid}
                notes={notes}
                onNotesChange={setNotes}
                notesMode={notesMode}
                selectedCell={selectedCell}
                onCellSelect={setSelectedCell}
                animatingCells={animatingCells}
                isPaused={isPaused}
              />
            </div>
          </div>
          {isPlaying && !isPaused && (
            <NumberPad
              size={size}
              onNumberClick={handleNumberClick}
              onDelete={handleDelete}
              onGiveUp={startSolve}
              notesMode={notesMode}
              onToggleNotes={() => setNotesMode(!notesMode)}
              grid={grid}
              disabled={!isPlaying || showCompletionModal || isSolving}
            />
          )}
        </div>
        {!isGameMode && experimentPanel}
      </main>

      {error && (
        <div className="toast toast-error">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-3 font-bold">x</button>
        </div>
      )}

      <PuzzleSelectionModal
        isOpen={showPuzzleModal}
        onClose={() => { setShowPuzzleModal(false); if (originalGrid) setIsPaused(false); }}
        onPuzzleSelect={handlePuzzleSelect}
        allowedTabs={isGameMode ? ['library', 'daily', 'upload', 'mypuzzles'] : null}
        initialTab={isGameMode ? 'library' : 'daily'}
      />

      <CompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        onPlayAgain={() => { setShowCompletionModal(false); setShowPuzzleModal(true); }}
        timeSeconds={timerRef.current}
        algorithmSolveTimeMs={algorithmSolveTime}
        puzzleSize={size}
        difficulty={difficulty}
        isDaily={isDaily}
        wasAlgorithmSolved={wasAlgorithmSolved}
      />

      <footer className="mt-6 text-center text-xs sm:text-sm text-[var(--color-text-muted)] px-2">
        <p>Built with React + WebAssembly | Supports 6x6, 9x9, 12x12, 16x16, and 25x25 puzzles</p>
      </footer>
    </div>
  );
}

export default PlayModePage;

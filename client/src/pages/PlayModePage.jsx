import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  getDefaultTimeout,
  getDefaultParameters
} from '../utils/wasmBridge';
import { createSolverWorkerRunner } from '../utils/solverWorkerClient';
import { downloadSolvedPuzzlePdf } from '../utils/gamePdfExport';
import LoadingScreen from '../components/LoadingScreen';
import GameHeader from '../components/GameHeader';
import SudokuGrid from '../components/SudokuGrid';
import NumberPad from '../components/NumberPad';
import PuzzleSelectionModal from '../components/PuzzleSelectionModal';
import CompletionModal from '../components/CompletionModal';

function computeEntropyThreshold(nAnts, entropyPct) {
  return Math.log2(nAnts) * (entropyPct / 100);
}

function computeChangedCells(previousGrid, nextGrid) {
  const changed = new Set();
  for (let row = 0; row < nextGrid.length; row += 1) {
    for (let col = 0; col < nextGrid[row].length; col += 1) {
      if (previousGrid?.[row]?.[col] !== nextGrid[row][col]) {
        changed.add(`${row}-${col}`);
      }
    }
  }
  return changed;
}

function PlayModePage({ mode }) {
  const isGameMode = mode === 'game';
  const location = useLocation();
  const workerRunnerRef = useRef(null);
  const latestGridRef = useRef(null);
  const activeSolveSessionRef = useRef(0);
  const timerRef = useRef(0);
  const saveTimeoutRef = useRef(null);
  const animationClearTimeoutRef = useRef(null);

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
  const [error, setError] = useState('');
  const [algorithmSolveTime, setAlgorithmSolveTime] = useState(null);
  const [isSolving, setIsSolving] = useState(false);
  const [animatingCells, setAnimatingCells] = useState(() => new Set());
  const [lastSolveMeta, setLastSolveMeta] = useState(null);
  const [solverParams, setSolverParams] = useState(() => ({ ...getDefaultParameters(9)[2], entropyPct: 92.5 }));

  useEffect(() => {
    setSolverParams({ ...getDefaultParameters(size)[2], entropyPct: 92.5 });
  }, [size]);

  useEffect(() => {
    latestGridRef.current = grid;
  }, [grid]);

  const resetTransientState = useCallback(() => {
    setSelectedCell(null);
    setNotesMode(false);
    setWasAlgorithmSolved(false);
    setShowCompletionModal(false);
    setError('');
    setAlgorithmSolveTime(null);
    setLastSolveMeta(null);
    setAnimatingCells(new Set());
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

  const finalizeSolveResult = useCallback(async (result, params, puzzleString) => {
    if (result?.success && result.solution) {
      const solvedGrid = stringToGrid(result.solution, size);
      setWasAlgorithmSolved(true);
      const ms = result.time != null ? result.time * 1000 : null;
      if (ms != null) setAlgorithmSolveTime(ms);
      setGrid(solvedGrid);
      latestGridRef.current = solvedGrid;
      setAnimatingCells(new Set());
      setLastSolveMeta({
        algorithm: 2,
        algorithmName: 'Multi-Colony DCM-ACO',
        params,
        originalGrid: (originalGrid || grid).map((row) => [...row]),
        solvedGrid,
        solvedAt: Date.now()
      });
      setTimeout(() => {
        setShowCompletionModal(true);
        setIsPlaying(false);
      }, 300);
    } else {
      setAlgorithmSolveTime(null);
      setError(result?.error || 'Puzzle not solved.');
    }
  }, [grid, originalGrid, size]);

  const runExperimentSolve = useCallback(async () => {
    if (!originalGrid || isSolving) return;
    const solveSessionId = Date.now();
    activeSolveSessionRef.current = solveSessionId;
    setIsSolving(true);
    setError('');
    setAnimatingCells(new Set());
    const puzzleString = gridToString(originalGrid, size);
    const nAnts = Number(solverParams.nAnts);
    const numACS = Number(solverParams.numACS);
    const entropyPct = Number(solverParams.entropyPct);
    const entropyThresh = computeEntropyThreshold(nAnts, entropyPct);
    const paramsSnapshot = {
      nAnts,
      numACS,
      numColonies: numACS + 1,
      q0: Number(solverParams.q0),
      xi: Number(solverParams.xi),
      rho: Number(solverParams.rho),
      evap: Number(solverParams.evap),
      convThresh: Number(solverParams.convThresh),
      entropyThresh,
      timeout: Number(solverParams.timeout)
    };
    try {
      if (!workerRunnerRef.current) {
        workerRunnerRef.current = createSolverWorkerRunner();
      }
      const result = await workerRunnerRef.current.start(
        puzzleString,
        2,
        paramsSnapshot,
        {
          withProgress: true,
          onProgress: (progressPayload) => {
            if (activeSolveSessionRef.current !== solveSessionId) {
              return;
            }
            if (!progressPayload?.solution) {
              return;
            }
            try {
              const nextGrid = stringToGrid(progressPayload.solution, size);
              const previousGrid = latestGridRef.current ?? originalGrid;
              const changed = computeChangedCells(previousGrid, nextGrid);
              latestGridRef.current = nextGrid;
              setGrid(nextGrid);
              setAnimatingCells(changed);
              if (animationClearTimeoutRef.current) {
                clearTimeout(animationClearTimeoutRef.current);
              }
              animationClearTimeoutRef.current = setTimeout(() => {
                setAnimatingCells(new Set());
              }, 180);
            } catch {
              // Ignore malformed progress payloads and continue solving.
            }
          }
        }
      );
      if (activeSolveSessionRef.current === solveSessionId) {
        await finalizeSolveResult(
          result,
          { ...paramsSnapshot, entropyPct, entropyThresh: Number(entropyThresh.toFixed(6)) },
          puzzleString
        );
      }
    } catch (err) {
      if (activeSolveSessionRef.current === solveSessionId) {
        setError(`Solving failed: ${err.message}`);
      }
    } finally {
      if (activeSolveSessionRef.current === solveSessionId) {
        setIsSolving(false);
      }
    }
  }, [finalizeSolveResult, isSolving, originalGrid, size, solverParams]);

  const runGameSolve = useCallback(async () => {
    if (!originalGrid || isSolving) return;
    const solveSessionId = Date.now();
    activeSolveSessionRef.current = solveSessionId;
    setError('');
    setIsSolving(true);
    setAnimatingCells(new Set());
    const puzzleString = gridToString(originalGrid, size);
    const defaultParams = { ...getDefaultParameters(size)[2], entropyPct: 92.5, timeout: getDefaultTimeout(size) };
    if (!workerRunnerRef.current) {
      workerRunnerRef.current = createSolverWorkerRunner();
    }
    try {
      const result = await workerRunnerRef.current.start(
        puzzleString,
        2,
        undefined,
        {
          withProgress: true,
          onProgress: (progressPayload) => {
            if (activeSolveSessionRef.current !== solveSessionId) {
              return;
            }
            if (!progressPayload?.solution) {
              return;
            }
            try {
              const nextGrid = stringToGrid(progressPayload.solution, size);
              const previousGrid = latestGridRef.current ?? originalGrid;
              const changed = computeChangedCells(previousGrid, nextGrid);
              latestGridRef.current = nextGrid;
              setGrid(nextGrid);
              setAnimatingCells(changed);
              if (animationClearTimeoutRef.current) {
                clearTimeout(animationClearTimeoutRef.current);
              }
              animationClearTimeoutRef.current = setTimeout(() => {
                setAnimatingCells(new Set());
              }, 180);
            } catch {
              // Ignore malformed progress payloads and continue solving.
            }
          }
        }
      );
      if (activeSolveSessionRef.current === solveSessionId) {
        await finalizeSolveResult(result, defaultParams, puzzleString);
      }
    } catch (err) {
      if (activeSolveSessionRef.current === solveSessionId) {
        setError(`Solving failed: ${err.message}`);
      }
    } finally {
      if (activeSolveSessionRef.current === solveSessionId) {
        setIsSolving(false);
      }
    }
  }, [finalizeSolveResult, isSolving, originalGrid, size]);

  const stopGameSolve = useCallback(() => {
    activeSolveSessionRef.current = Date.now();
    workerRunnerRef.current?.stop();
    if (animationClearTimeoutRef.current) {
      clearTimeout(animationClearTimeoutRef.current);
      animationClearTimeoutRef.current = null;
    }
    setAnimatingCells(new Set());
    setIsSolving(false);
    setAlgorithmSolveTime(null);
    setError('Solving stopped. Puzzle not solved.');
  }, []);

  useEffect(() => () => {
    workerRunnerRef.current?.dispose();
    if (animationClearTimeoutRef.current) {
      clearTimeout(animationClearTimeoutRef.current);
      animationClearTimeoutRef.current = null;
    }
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
  const effectivePaused = !isGameMode && isPaused;

  const experimentPanel = (
    <aside className="card w-full lg:w-[560px] self-start">
      <h3 className="text-lg font-semibold mb-3">Experiment Controls</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <button type="button" className="btn btn-secondary w-full" onClick={() => setShowPuzzleModal(true)} disabled={isSolving}>
            Open Puzzle Library
          </button>
        </div>

        <div>
          <label className="block text-sm mb-1">Algorithm</label>
          <input className="input w-full" value="Multi-Colony DCM-ACO" disabled />
        </div>

        <div>
          <label className="block text-sm mb-1">Timeout (sec)</label>
          <input
            className="input w-full"
            type="number"
            min="1"
            max="300"
            value={solverParams.timeout ?? 10}
            onChange={(e) => setSolverParams((prev) => ({ ...prev, timeout: Number(e.target.value) }))}
            disabled={isSolving}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Number of Ants</label>
          <input
            className="input w-full"
            type="number"
            min="1"
            max="50"
            value={solverParams.nAnts ?? 3}
            onChange={(e) => setSolverParams((prev) => ({ ...prev, nAnts: Number(e.target.value) }))}
            disabled={isSolving}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">ACS Colonies (numACS)</label>
          <input
            className="input w-full"
            type="number"
            min="1"
            max="12"
            value={solverParams.numACS ?? 6}
            onChange={(e) => setSolverParams((prev) => ({ ...prev, numACS: Number(e.target.value) }))}
            disabled={isSolving}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">q0</label>
          <input className="input w-full" type="number" step="0.01" min="0" max="1" value={solverParams.q0 ?? 0.9} onChange={(e) => setSolverParams((prev) => ({ ...prev, q0: Number(e.target.value) }))} disabled={isSolving} />
        </div>

        <div>
          <label className="block text-sm mb-1">xi</label>
          <input className="input w-full" type="number" step="0.01" min="0" max="1" value={solverParams.xi ?? 0.1} onChange={(e) => setSolverParams((prev) => ({ ...prev, xi: Number(e.target.value) }))} disabled={isSolving} />
        </div>

        <div>
          <label className="block text-sm mb-1">rho</label>
          <input className="input w-full" type="number" step="0.01" min="0" max="1" value={solverParams.rho ?? 0.9} onChange={(e) => setSolverParams((prev) => ({ ...prev, rho: Number(e.target.value) }))} disabled={isSolving} />
        </div>

        <div>
          <label className="block text-sm mb-1">evap</label>
          <input className="input w-full" type="number" step="0.0001" min="0" max="1" value={solverParams.evap ?? 0.0125} onChange={(e) => setSolverParams((prev) => ({ ...prev, evap: Number(e.target.value) }))} disabled={isSolving} />
        </div>

        <div>
          <label className="block text-sm mb-1">convThresh</label>
          <input className="input w-full" type="number" step="0.01" min="0" max="1" value={solverParams.convThresh ?? 0.8} onChange={(e) => setSolverParams((prev) => ({ ...prev, convThresh: Number(e.target.value) }))} disabled={isSolving} />
        </div>

        <div>
          <label className="block text-sm mb-1">Entropy %</label>
          <input
            className="input w-full"
            type="number"
            step="0.001"
            min="0"
            max="100"
            value={solverParams.entropyPct ?? 92.5}
            onChange={(e) => setSolverParams((prev) => ({ ...prev, entropyPct: Number(e.target.value) }))}
            disabled={isSolving}
          />
        </div>

        <div className="md:col-span-2">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            Computed entropyThresh: {Number.isFinite(solverParams.nAnts) && Number.isFinite(solverParams.entropyPct)
              ? computeEntropyThreshold(Number(solverParams.nAnts), Number(solverParams.entropyPct)).toFixed(6)
              : 'N/A'}
          </p>
          <button type="button" className="btn btn-primary w-full" onClick={startSolve} disabled={isSolving || !originalGrid}>
            {isSolving ? 'Solving...' : 'Solve'}
          </button>
        </div>
      </div>
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
        isPaused={effectivePaused}
        difficulty={difficulty}
        puzzleSize={size}
        onNewPuzzle={() => {
          setShowPuzzleModal(true);
          if (!isGameMode && isPlaying) setIsPaused(true);
        }}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        showPauseControl={!isGameMode}
        timerRef={timerRef}
        isDaily={isDaily}
        algorithmSolveTime={algorithmSolveTime}
        initialSeconds={initialTimerSeconds}
      />
      {isGameMode && (
        <div className="flex items-center gap-2 flex-wrap justify-center mt-3">
          {isSolving && (
            <button type="button" className="btn btn-danger" onClick={stopGameSolve}>
              Stop
            </button>
          )}
          {lastSolveMeta?.solvedGrid && (
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
      )}

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
                isPaused={effectivePaused}
              />
            </div>
          </div>
          {isPlaying && !effectivePaused && (
            <NumberPad
              size={size}
              onNumberClick={handleNumberClick}
              onDelete={handleDelete}
              onAction={startSolve}
              showAction={isGameMode}
              actionLabel="Solve"
              actionClassName="btn btn-primary"
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
        onClose={() => {
          setShowPuzzleModal(false);
          if (originalGrid && !isGameMode) setIsPaused(false);
        }}
        onPuzzleSelect={handlePuzzleSelect}
        allowedTabs={['library', 'daily', 'mypuzzles']}
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

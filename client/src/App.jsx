import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  createEmptyGrid, 
  stringToGrid, 
  createEmptyNotesGrid,
  clearCellNotes,
  removeNoteFromRelatedCells,
  isPuzzleSolved
} from './utils/sudokuUtils';
import { getDailyPuzzle } from './utils/dailyPuzzleService';

// Import components
import LoadingScreen from './components/LoadingScreen';
import GameHeader from './components/GameHeader';
import SudokuGrid from './components/SudokuGrid';
import NumberPad from './components/NumberPad';
import PuzzleSelectionModal from './components/PuzzleSelectionModal';
import AlgorithmSolverModal from './components/AlgorithmSolverModal';
import CompletionModal from './components/CompletionModal';

function App() {
  // Game state
  const [grid, setGrid] = useState(() => createEmptyGrid(9));
  const [size, setSize] = useState(9);
  const [originalGrid, setOriginalGrid] = useState(null);
  const [notes, setNotes] = useState(() => createEmptyNotesGrid(9));
  const [notesMode, setNotesMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [isDaily, setIsDaily] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Generating daily puzzle...');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showPuzzleModal, setShowPuzzleModal] = useState(false);
  const [showAlgorithmModal, setShowAlgorithmModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [wasAlgorithmSolved, setWasAlgorithmSolved] = useState(false);
  const [animatingCells, setAnimatingCells] = useState(new Set());
  const [error, setError] = useState('');
  const [algorithmSolveTime, setAlgorithmSolveTime] = useState(null);
  
  // Timer ref
  const timerRef = useRef(0);

  // Load daily puzzle on first load
  useEffect(() => {
    let mounted = true;
    
    const loadInitialPuzzle = async () => {
      setIsLoading(true);
      setLoadingMessage('Generating daily puzzle...');
      
      try {
        // Small delay to show loading screen
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!mounted) return;
        
        // Get the daily puzzle (random size and difficulty)
        const puzzleData = await getDailyPuzzle();
        
        if (!mounted) return;
        
        const puzzleSize = puzzleData.size;
        const newGrid = stringToGrid(puzzleData.puzzleString, puzzleSize);
        
        setGrid(newGrid);
        setSize(puzzleSize);
        setOriginalGrid(newGrid.map(row => [...row]));
        setNotes(createEmptyNotesGrid(puzzleSize));
        setDifficulty(puzzleData.difficulty);
        setIsDaily(true);
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load initial puzzle:', err);
        if (!mounted) return;
        setIsLoading(false);
        setShowPuzzleModal(true);
      }
    };
    
    loadInitialPuzzle();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Handle puzzle selection from modal
  const handlePuzzleSelect = useCallback((puzzleData) => {
    const { grid: newGrid, size: newSize, difficulty: newDifficulty, isDaily: newIsDaily } = puzzleData;
    
    setGrid(newGrid);
    setSize(newSize);
    setOriginalGrid(newGrid.map(row => [...row]));
    setNotes(createEmptyNotesGrid(newSize));
    setDifficulty(newDifficulty);
    setIsDaily(newIsDaily);
    setIsPlaying(true);
    setIsPaused(false);
    setSelectedCell(null);
    setNotesMode(false);
    setWasAlgorithmSolved(false);
    setShowCompletionModal(false);
    setError('');
    setAlgorithmSolveTime(null);
  }, []);

  // Handle cell changes
  const handleCellChange = useCallback((row, col, value) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(r => [...r]);
      newGrid[row][col] = value;
      return newGrid;
    });
    
    // Clear notes for this cell and remove value from related cells' notes
    if (value !== '') {
      setNotes(prevNotes => {
        let newNotes = clearCellNotes(prevNotes, row, col);
        newNotes = removeNoteFromRelatedCells(newNotes, row, col, parseInt(value), size);
        return newNotes;
      });
    }
  }, [size]);

  // Check for puzzle completion after grid changes
  useEffect(() => {
    if (isPlaying && originalGrid && !showCompletionModal) {
      if (isPuzzleSolved(grid, size)) {
        setShowCompletionModal(true);
        setIsPlaying(false);
      }
    }
  }, [grid, size, isPlaying, originalGrid, showCompletionModal]);

  // Handle number pad click
  const handleNumberClick = useCallback((num) => {
    if (!selectedCell) return;
    
    const [row, col] = selectedCell;
    
    // Check if this is an original cell
    if (originalGrid && originalGrid[row][col] !== '') {
      return;
    }
    
    if (notesMode) {
      // Toggle note
      setNotes(prevNotes => {
        const newNotes = prevNotes.map(r => r.map(c => new Set(c)));
        if (newNotes[row][col].has(num)) {
          newNotes[row][col].delete(num);
        } else {
          newNotes[row][col].add(num);
        }
        return newNotes;
      });
    } else {
      // Place number
      handleCellChange(row, col, String(num));
    }
  }, [selectedCell, originalGrid, notesMode, handleCellChange]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!selectedCell) return;
    
    const [row, col] = selectedCell;
    
    // Check if this is an original cell
    if (originalGrid && originalGrid[row][col] !== '') {
      return;
    }
    
    if (notesMode) {
      // Clear all notes for this cell
      setNotes(prevNotes => clearCellNotes(prevNotes, row, col));
    } else {
      // Clear cell value
      handleCellChange(row, col, '');
    }
  }, [selectedCell, originalGrid, notesMode, handleCellChange]);

  // Handle give up - open algorithm modal
  const handleGiveUp = useCallback(() => {
    setIsPaused(true);
    setShowAlgorithmModal(true);
  }, []);

  // Handle algorithm solution start
  const handleSolutionStart = useCallback(() => {
    setWasAlgorithmSolved(true);
    setAnimatingCells(new Set());
  }, []);

  // Handle algorithm solution step (animate cells)
  const handleSolutionStep = useCallback((row, col, value) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(r => [...r]);
      newGrid[row][col] = value;
      return newGrid;
    });
    
    setAnimatingCells(prev => new Set([...prev, `${row}-${col}`]));
    
    // Remove animation class after animation completes
    setTimeout(() => {
      setAnimatingCells(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${row}-${col}`);
        return newSet;
      });
    }, 300);
  }, []);

  // Handle algorithm solution complete
  const handleSolutionComplete = useCallback((result) => {
    setShowAlgorithmModal(false);
    if (result && result.success) {
      // Store the solve time in ms (WASM returns time in seconds)
      const ms = result.time != null ? result.time * 1000 : undefined;
      if (ms !== undefined) {
        setAlgorithmSolveTime(ms);
      }
      setTimeout(() => {
        setShowCompletionModal(true);
        setIsPlaying(false);
      }, 500);
    } else {
      setIsPaused(false);
      setAlgorithmSolveTime(null);
    }
  }, []);

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    setShowCompletionModal(false);
    setShowPuzzleModal(true);
  }, []);

  // Handle new puzzle button
  const handleNewPuzzle = useCallback(() => {
    setShowPuzzleModal(true);
    if (isPlaying) {
      setIsPaused(true);
    }
  }, [isPlaying]);

  // Handle close puzzle modal
  const handleClosePuzzleModal = useCallback(() => {
    setShowPuzzleModal(false);
    if (originalGrid) {
      setIsPaused(false);
    }
  }, [originalGrid]);

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen message={loadingMessage} subMessage="This may take a moment..." />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-2 sm:px-4 py-3 sm:py-6 w-full max-w-full overflow-x-hidden">
      {/* Game Header */}
      <GameHeader
        isPlaying={isPlaying}
        isPaused={isPaused}
        difficulty={difficulty}
        puzzleSize={size}
        onNewPuzzle={handleNewPuzzle}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        timerRef={timerRef}
        isDaily={isDaily}
        algorithmSolveTime={algorithmSolveTime}
      />
      
      {/* Main Game Area */}
      <main className="flex flex-col items-center flex-1 w-full max-w-full overflow-x-hidden">
        {/* Sudoku Grid */}
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
        
        {/* Number Pad */}
        {isPlaying && !isPaused && (
          <NumberPad
            size={size}
            onNumberClick={handleNumberClick}
            onDelete={handleDelete}
            onGiveUp={handleGiveUp}
            notesMode={notesMode}
            onToggleNotes={() => setNotesMode(!notesMode)}
            grid={grid}
            disabled={!isPlaying || showCompletionModal}
          />
        )}
      </main>
      
      {/* Error Toast */}
      {error && (
        <div className="toast toast-error">
          <span>{error}</span>
          <button 
            onClick={() => setError('')}
            className="ml-3 font-bold"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Modals */}
      <PuzzleSelectionModal
        isOpen={showPuzzleModal}
        onClose={handleClosePuzzleModal}
        onPuzzleSelect={handlePuzzleSelect}
      />
      
      <AlgorithmSolverModal
        isOpen={showAlgorithmModal}
        onClose={() => {
          setShowAlgorithmModal(false);
          setIsPaused(false);
        }}
        puzzle={originalGrid || grid}
        size={size}
        onSolutionStart={handleSolutionStart}
        onSolutionStep={handleSolutionStep}
        onSolutionComplete={handleSolutionComplete}
      />
      
      <CompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        onPlayAgain={handlePlayAgain}
        timeSeconds={timerRef.current}
        algorithmSolveTimeMs={algorithmSolveTime}
        puzzleSize={size}
        difficulty={difficulty}
        isDaily={isDaily}
        wasAlgorithmSolved={wasAlgorithmSolved}
      />
      
      {/* Footer */}
      <footer className="mt-4 sm:mt-8 mb-2 sm:mb-0 text-center text-xs sm:text-sm text-[var(--color-text-muted)] px-2">
        <p className="leading-relaxed">
          <span className="block sm:inline">Built with React + WebAssembly</span>
          <span className="hidden sm:inline"> | </span>
          <span className="block sm:inline">Supports 6×6, 9×9, 12×12, 16×16, and 25×25 puzzles</span>
        </p>
      </footer>
    </div>
  );
}

export default App;

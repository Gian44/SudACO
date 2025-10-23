import React, { useState, useCallback } from 'react';
import { solveSudoku, getDefaultParameters } from './utils/wasmBridge';
import { 
  createEmptyGrid, 
  stringToGrid, 
  gridToString, 
  validateGrid,
  getPuzzleSizeFromString 
} from './utils/sudokuUtils';

// Import components
import PuzzleLoader from './components/PuzzleLoader';
import SudokuGrid from './components/SudokuGrid';
import AlgorithmSelector from './components/AlgorithmSelector';
import ParameterPanel from './components/ParameterPanel';
import SolverControls from './components/SolverControls';
import ResultDisplay from './components/ResultDisplay';
import SolverTests from './components/SolverTests';

// Tailwind CSS is now imported globally

function App() {
  // State management
  const [grid, setGrid] = useState(() => createEmptyGrid(9));
  const [size, setSize] = useState(9);
  const [algorithm, setAlgorithm] = useState(2); // Default to DCM-ACO
  const [parameters, setParameters] = useState(() => getDefaultParameters()[2]);
  const [isSolving, setIsSolving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [originalGrid, setOriginalGrid] = useState(null);
  const [isParametersCollapsed, setIsParametersCollapsed] = useState(false);

  // Handle puzzle loading
  const handlePuzzleLoad = useCallback((puzzleString, puzzleSize, fileName) => {
    try {
      const newGrid = stringToGrid(puzzleString, puzzleSize);
      const validation = validateGrid(newGrid, puzzleSize);
      
      if (!validation.isValid) {
        setError(`Invalid puzzle: ${validation.errors.join(', ')}`);
        return;
      }

      setGrid(newGrid);
      setSize(puzzleSize);
      setOriginalGrid(newGrid.map(row => [...row])); // Deep copy
      setResult(null);
      setError('');
      
      console.log(`Loaded puzzle: ${fileName} (${puzzleSize}×${puzzleSize})`);
    } catch (err) {
      setError(`Failed to load puzzle: ${err.message}`);
    }
  }, []);

  // Handle cell changes
  const handleCellChange = useCallback((row, col, value) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => [...row]);
      newGrid[row][col] = value;
      return newGrid;
    });
  }, []);

  // Handle algorithm change
  const handleAlgorithmChange = useCallback((newAlgorithm) => {
    setAlgorithm(newAlgorithm);
    const defaults = getDefaultParameters()[newAlgorithm];
    setParameters(defaults);
  }, []);

  // Handle parameter changes
  const handleParametersChange = useCallback((newParameters) => {
    setParameters(newParameters);
  }, []);

  // Handle solving
  const handleSolve = useCallback(async () => {
    if (isSolving) return;

    setIsSolving(true);
    setResult(null);
    setError('');

    try {
      const puzzleString = gridToString(grid, size);
      const solveResult = await solveSudoku(puzzleString, algorithm, parameters);
      
      if (solveResult.success && solveResult.solution) {
        // Convert solution back to grid
        const solutionGrid = stringToGrid(solveResult.solution, size);
        setGrid(solutionGrid);
      }
      
      setResult(solveResult);
    } catch (err) {
      setError(`Solving failed: ${err.message}`);
      setResult({ success: false, error: err.message });
    } finally {
      setIsSolving(false);
    }
  }, [grid, size, algorithm, parameters, isSolving]);

  // Handle clear grid
  const handleClear = useCallback(() => {
    setGrid(createEmptyGrid(size));
    setResult(null);
    setError('');
  }, [size]);

  // Handle reset parameters
  const handleResetParameters = useCallback(() => {
    const defaults = getDefaultParameters()[algorithm];
    setParameters(defaults);
  }, [algorithm]);

  // Handle error display
  const handleError = useCallback((errorMessage) => {
    setError(errorMessage);
  }, []);

  // Check if we have a puzzle (a puzzle is loaded if originalGrid exists, even if it's 0% filled)
  const hasPuzzle = originalGrid !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Sudoku Solver with Multi-Colony DCM-ACO</h1>
          <p className="mt-2 text-gray-600">WebAssembly-powered Sudoku solver supporting multiple algorithms</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Section: Dynamic layout based on puzzle size */}
        <div className={`mb-8 ${size >= 16 ? 'flex flex-col lg:flex-row gap-8 justify-center' : 'grid grid-cols-1 xl:grid-cols-2 gap-8'}`}>
          {/* Left Column: Puzzle + Solver Controls */}
          <div className={`${size >= 16 ? 'flex flex-col gap-6' : 'flex flex-col gap-6'}`}>
            {/* Puzzle Grid */}
            <div className="flex justify-center">
              <SudokuGrid
                grid={grid}
                onChange={handleCellChange}
                size={size}
                readOnly={isSolving}
                highlightChanges={true}
                originalGrid={originalGrid}
              />
            </div>

            {/* Solver Controls directly below puzzle */}
            <div className="flex justify-center">
              <SolverControls
                onSolve={handleSolve}
                onClear={handleClear}
                onResetParameters={handleResetParameters}
                isSolving={isSolving}
                hasPuzzle={hasPuzzle}
                algorithm={algorithm}
                size={size}
              />
            </div>

            {/* Result Display directly below solver controls */}
            <div className="flex justify-center">
              <ResultDisplay
                result={result}
                isVisible={!!result}
                size={size}
              />
            </div>
          </div>

          {/* Right Column: Load Puzzle, Algorithm, Parameters */}
          <div className={`space-y-6 ${size >= 16 ? 'lg:ml-8 lg:min-w-[400px]' : ''}`}>
            <PuzzleLoader 
              onPuzzleLoad={handlePuzzleLoad}
              onError={handleError}
            />
            
            <AlgorithmSelector
              selectedAlgorithm={algorithm}
              onAlgorithmChange={handleAlgorithmChange}
            />

            <ParameterPanel
              algorithm={algorithm}
              parameters={parameters}
              onParametersChange={handleParametersChange}
              isCollapsed={isParametersCollapsed}
              onToggleCollapse={() => setIsParametersCollapsed(!isParametersCollapsed)}
            />
          </div>
        </div>

        {/* Bottom Center: Solver Tests - spans full width of puzzle + control panel */}
        <div className={`${size >= 16 ? 'flex justify-center' : 'flex justify-center'}`}>
          <div 
            className={`${size >= 16 ? 'w-full' : 'w-full'}`}
            style={size >= 16 ? {
              maxWidth: `${size === 16 ? 640 + 50 + 400 + 32 : 800 + 50 + 400 + 32}px` // grid + padding + control panel + gap
            } : {}}
          >
            <SolverTests />
          </div>
        </div>
      </main>

      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-50">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">⚠️</span>
            <span className="text-red-700">{error}</span>
            <button 
              onClick={() => setError('')}
              className="ml-4 text-red-500 hover:text-red-700 font-bold text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            Built with React + WebAssembly | 
            Supports 6×6, 9×9, 12×12, 16×16, and 25×25 puzzles | 
            Algorithms: Backtracking, ACS, Multi-Colony DCM-ACO
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
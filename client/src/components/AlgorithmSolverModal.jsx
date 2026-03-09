import React, { useState, useCallback, useEffect } from 'react';
import { getAlgorithmNames, getDefaultParameters, solveSudoku } from '../utils/wasmBridge';
import { gridToString, stringToGrid } from '../utils/sudokuUtils';

const PROGRESS_INTERVALS = [
  { label: '1', value: 1 },
  { label: '5', value: 5 },
  { label: '10', value: 10 }
];

const AlgorithmSolverModal = ({
  isOpen,
  onClose,
  puzzle,
  size,
  onSolutionStart,
  onSolutionStep,
  onSolutionComplete,
  onProgressUpdate
}) => {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(2); // Default to DCM-ACO
  const [parameters, setParameters] = useState(() => getDefaultParameters(size)[2]);
  const [isParametersExpanded, setIsParametersExpanded] = useState(false);
  const [progressInterval, setProgressInterval] = useState(5);
  const [isSolving, setIsSolving] = useState(false);
  const [solveResult, setSolveResult] = useState(null);
  const [error, setError] = useState('');

  const algorithmNames = getAlgorithmNames();

  const algorithms = [
    {
      id: 0,
      name: algorithmNames[0],
      description: 'Single-colony Ant Colony Optimization (ACO)',
      icon: '\uD83D\uDC1C'
    },
    {
      id: 2,
      name: algorithmNames[2],
      description: 'Multi-Colony DCM-ACO (recommended)',
      icon: '\uD83D\uDC1C\uD83D\uDC1C'
    }
  ];

  // Update parameters when algorithm or size changes
  useEffect(() => {
    setParameters(getDefaultParameters(size)[selectedAlgorithm]);
  }, [selectedAlgorithm, size]);

  // Handle parameter change
  const handleParameterChange = useCallback((key, value) => {
    setParameters(prev => {
      const newParams = { ...prev, [key]: value };
      if (key === 'numACS') {
        newParams.numColonies = (value || 0) + 1;
      }
      return newParams;
    });
  }, []);

  // Reset parameters
  const handleResetParams = useCallback(() => {
    setParameters(getDefaultParameters(size)[selectedAlgorithm]);
    setProgressInterval(5);
  }, [size, selectedAlgorithm]);

  // Handle solve
  const handleSolve = useCallback(async () => {
    setIsSolving(true);
    setError('');
    setSolveResult(null);
    onSolutionStart();

    // Close modal immediately so the grid is visible during solving
    onClose();

    // Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const puzzleString = gridToString(puzzle, size);

      // Progress callback: update grid with current best solution in batch
      const handleProgress = (iteration, bestCellsFilled, totalCells, boardString) => {
        if (onProgressUpdate) {
          onProgressUpdate(boardString);
        }
      };

      // Merge progressInterval into params for the WASM call
      const solveParams = { ...parameters, progressInterval };

      const result = await solveSudoku(puzzleString, selectedAlgorithm, solveParams, handleProgress);

      setSolveResult(result);

      if (result.success && result.solution) {
        // Final solution — update grid one last time with the complete solution
        if (onProgressUpdate) {
          onProgressUpdate(result.solution);
        }
        onSolutionComplete(result);
      } else {
        setError(result.error || 'Failed to solve puzzle');
        onSolutionComplete(null);
      }
    } catch (err) {
      setError(`Solving failed: ${err.message}`);
      onSolutionComplete(null);
    } finally {
      setIsSolving(false);
    }
  }, [puzzle, size, selectedAlgorithm, parameters, progressInterval, onSolutionStart, onSolutionComplete, onClose, onProgressUpdate]);

  // Render parameter input
  const renderParameter = useCallback((key, label, min = 0, max = 100, step = 0.1) => {
    return (
      <div key={key} className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={parameters[key] ?? ''}
          onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
          className="input text-sm py-2"
          disabled={isSolving}
        />
      </div>
    );
  }, [parameters, handleParameterChange, isSolving]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={isSolving ? undefined : onClose}>
      <div className="modal-content w-full max-w-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gradient">Algorithm Solver</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Let the algorithm solve the puzzle for you
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSolving}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Algorithm Selection */}
        <div className="space-y-3 mb-6">
          <label className="text-sm font-medium">Select Algorithm</label>
          {algorithms.map(algo => (
            <button
              key={algo.id}
              onClick={() => setSelectedAlgorithm(algo.id)}
              disabled={isSolving}
              className={`
                w-full p-4 rounded-xl text-left transition-all
                ${selectedAlgorithm === algo.id
                  ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]'
                  : 'bg-[var(--color-bg-elevated)] border-2 border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{algo.icon}</span>
                <div>
                  <div className="font-semibold">{algo.name}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">{algo.description}</div>
                </div>
                {selectedAlgorithm === algo.id && (
                  <svg className="w-6 h-6 ml-auto text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Update Frequency (for ACO algorithms) */}
        {(selectedAlgorithm === 0 || selectedAlgorithm === 2) && (
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">Update Frequency (iterations)</label>
            <div className="flex gap-2">
              {PROGRESS_INTERVALS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setProgressInterval(value)}
                  disabled={isSolving}
                  className={`
                    flex-1 py-2 px-4 rounded-lg font-medium transition-all
                    ${progressInterval === value
                      ? 'bg-[var(--color-secondary)] text-white'
                      : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-secondary)]'
                    }
                    disabled:opacity-50
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Parameters (Collapsible) */}
        <div className="mb-6">
          <button
            onClick={() => setIsParametersExpanded(!isParametersExpanded)}
            disabled={isSolving}
            className="flex items-center justify-between w-full p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-50"
          >
            <span className="font-medium">Advanced Parameters</span>
            <svg
              className={`w-5 h-5 transition-transform ${isParametersExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isParametersExpanded && (
            <div className="mt-3 p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <div className="grid grid-cols-2 gap-4">
                {renderParameter('timeout', 'Timeout (sec)', 1, 300, 1)}

                {(selectedAlgorithm === 0 || selectedAlgorithm === 2) && (
                  <>
                    {renderParameter('nAnts', 'Number of Ants', 1, 50, 1)}
                    {renderParameter('q0', 'Exploitation (q0)', 0, 1, 0.01)}
                    {renderParameter('rho', 'Evaporation (\u03C1)', 0, 1, 0.01)}
                    {renderParameter('evap', 'Best Sol. Evap.', 0, 0.1, 0.001)}
                  </>
                )}

                {selectedAlgorithm === 2 && (
                  <>
                    {renderParameter('numACS', 'ACS Colonies', 1, 5, 1)}
                    {renderParameter('convThresh', 'Conv. Threshold', 0, 1, 0.01)}
                    {renderParameter('entropyThresh', 'Entropy Thresh.', 0, 10, 0.1)}
                  </>
                )}
              </div>

              <button
                onClick={handleResetParams}
                disabled={isSolving}
                className="mt-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
              >
                Reset to defaults
              </button>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-error)]/20 border border-[var(--color-error)]/50 text-[var(--color-error)]">
            {error}
          </div>
        )}

        {/* Solve Button */}
        <button
          onClick={handleSolve}
          disabled={isSolving}
          className="btn btn-primary w-full py-4 text-lg"
        >
          {isSolving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="spinner" />
              Solving...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Solve Puzzle
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default AlgorithmSolverModal;

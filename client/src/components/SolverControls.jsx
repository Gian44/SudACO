import React from 'react';

function SolverControls({ onSolve, onResetParameters, isSolving, hasPuzzle, algorithm, size = 9 }) {
  // Calculate the same total width as SudokuGrid including padding and borders
  // SudokuGrid has p-6 (24px padding on each side = 48px total) + 2px border = 50px extra
  const getTotalWidth = () => {
    const gridWidth = size === 6 ? 360 :
                      size === 9 ? 450 : 
                      size === 12 ? 540 :
                      size === 16 ? 640 : 
                      800;
    const paddingAndBorder = 50; // 48px padding + 2px border
    const vwWidth = size === 6 ? '35vw' :
                    size === 9 ? '40vw' : 
                    size === 12 ? '50vw' :
                    size === 16 ? '60vw' : 
                    '70vw';
    return `min(${gridWidth + paddingAndBorder}px, ${vwWidth})`;
  };

  const getMaxWidth = () => {
    const gridWidth = size === 6 ? 360 :
                      size === 9 ? 450 : 
                      size === 12 ? 540 :
                      size === 16 ? 640 : 
                      800;
    const paddingAndBorder = 50;
    return `${gridWidth + paddingAndBorder}px`;
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      style={{
        width: getTotalWidth(),
        maxWidth: getMaxWidth()
      }}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Solver Controls</h3>
      
      <div className="space-y-3">
        <button
          onClick={onSolve}
          disabled={isSolving || !hasPuzzle}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            isSolving || !hasPuzzle
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          }`}
        >
          {isSolving ? 'Solving...' : 'Solve Sudoku'}
        </button>
        
        <button
          onClick={onResetParameters}
          disabled={isSolving}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            isSolving
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500'
          }`}
        >
          Reset Parameters
        </button>
      </div>
      
      {!hasPuzzle && (
        <p className="mt-3 text-sm text-gray-500 text-center">
          Load a puzzle to enable solving
        </p>
      )}
    </div>
  );
}

export default SolverControls;
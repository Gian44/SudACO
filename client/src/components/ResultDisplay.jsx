import React from 'react';

function ResultDisplay({ result, isVisible, size = 9 }) {
  if (!isVisible || !result) return null;

  const { success, time, error } = result;

  // Calculate the same total width as SudokuGrid and SolverControls
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
      className={`rounded-lg border p-6 shadow-sm ${
        success 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}
      style={{
        width: getTotalWidth(),
        maxWidth: getMaxWidth()
      }}
    >
      <h3 className={`text-lg font-semibold mb-4 ${
        success ? 'text-green-800' : 'text-red-800'
      }`}>
        Solver Result
      </h3>
      
      {error ? (
        <div className="text-red-700">
          <p className="font-medium">Error:</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : (
        <div className={`space-y-2 ${success ? 'text-green-700' : 'text-red-700'}`}>
          <div className="flex justify-between">
            <span className="font-medium">Status:</span>
            <span className="font-semibold">
              {success ? '✅ Solved!' : '❌ Failed to solve'}
            </span>
          </div>
          
          {time !== undefined && (
            <div className="flex justify-between">
              <span className="font-medium">Time:</span>
              <span>{time} seconds</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ResultDisplay;
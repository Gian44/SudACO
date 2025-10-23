import React from 'react';

function ResultDisplay({ result, isVisible }) {
  if (!isVisible || !result) return null;

  const { success, solution, time, cellsFilled, error } = result;

  return (
    <div className={`rounded-lg border p-6 shadow-sm ${
      success 
        ? 'bg-green-50 border-green-200' 
        : 'bg-red-50 border-red-200'
    }`}>
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
              <span>{time.toFixed(3)} seconds</span>
            </div>
          )}
          
          {cellsFilled !== undefined && (
            <div className="flex justify-between">
              <span className="font-medium">Cells Filled:</span>
              <span>{cellsFilled}</span>
            </div>
          )}
          
          {success && solution && (
            <div className="mt-4 pt-4 border-t border-green-300">
              <p className="text-sm font-medium mb-2">Solution String:</p>
              <div className="bg-white p-3 rounded border text-xs font-mono break-all">
                {solution}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ResultDisplay;
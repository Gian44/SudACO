import React, { useState } from 'react';
import { runTests } from '../utils/solverTests';

function SolverTests() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    setTestResults(null);
    
    // Capture console output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    try {
      await runTests();
      setTestResults({
        success: true,
        logs: logs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setTestResults({
        success: false,
        error: error.message,
        logs: logs,
        timestamp: new Date().toISOString()
      });
    } finally {
      console.log = originalLog;
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">🧪 Solver Tests</h3>
      <p className="text-sm text-gray-600 mb-4">Test all algorithms with different puzzle sizes and parameters.</p>
      
      <button 
        onClick={handleRunTests}
        disabled={isRunning}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          isRunning
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
        }`}
      >
        {isRunning ? 'Running Tests...' : 'Run Tests'}
      </button>
      
      {testResults && (
        <div className={`mt-4 rounded-lg border p-4 ${
          testResults.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            testResults.success ? 'text-green-800' : 'text-red-800'
          }`}>
            Test Results
          </h4>
          
          <div className="bg-gray-900 text-green-400 rounded-md p-3 text-xs font-mono max-h-64 overflow-y-auto">
            {testResults.logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
          </div>
          
          {testResults.error && (
            <div className="mt-3 bg-red-100 border border-red-300 rounded-md p-3">
              <strong className="text-red-800">Error:</strong>
              <p className="text-red-700 text-sm mt-1">{testResults.error}</p>
            </div>
          )}
          
          <div className="mt-3 text-xs text-gray-500 text-right">
            Run at: {new Date(testResults.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

export default SolverTests;
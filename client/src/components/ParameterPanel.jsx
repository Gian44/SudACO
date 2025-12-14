import React, { useState } from 'react';
import { getDefaultParameters } from '../utils/wasmBridge';

const ParameterPanel = ({ algorithm, parameters, onParametersChange, isCollapsed, onToggleCollapse, size = 9 }) => {
  const [localParams, setLocalParams] = useState(parameters);

  // Update defaults when algorithm or size changes
  React.useEffect(() => {
    const defaults = getDefaultParameters(size)[algorithm];
    setLocalParams(defaults);
    onParametersChange(defaults);
  }, [algorithm, size, onParametersChange]);

  // Keep local state in sync when parameters are updated externally
  React.useEffect(() => {
    setLocalParams(parameters);
  }, [parameters]);

  // Handle parameter change
  const handleParameterChange = (key, value) => {
    const newParams = { ...localParams, [key]: value };
    // Keep numColonies in sync: always numACS + 1 (1 MMAS colony)
    if (key === 'numACS') {
      const numACS = Number.isFinite(value) ? value : localParams.numACS;
      newParams.numColonies = (numACS || 0) + 1;
    }
    setLocalParams(newParams);
    onParametersChange(newParams);
  };

  // Reset to defaults
  const handleReset = () => {
    const defaults = getDefaultParameters(size)[algorithm];
    setLocalParams(defaults);
    onParametersChange(defaults);
  };

  // Render parameter input
  const renderParameter = (key, label, type = 'number', min = 0, max = 100, step = 0.1) => {
    return (
      <div key={key} className="flex flex-col space-y-1">
        <label htmlFor={key} className="text-sm font-medium text-gray-700">
          {label}:
        </label>
        <input
          id={key}
          type={type}
          min={min}
          max={max}
          step={step}
          value={localParams[key] ?? ''}
          onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>
    );
  };

  // Get parameters for current algorithm
  const getAlgorithmParameters = () => {
    const params = [];
    
    // Common parameters
    params.push(renderParameter('timeout', 'Timeout (seconds)', 'number', 1, 300, 1));
    
    if (algorithm === 0 || algorithm === 2) {
      // ACS and DCM-ACO parameters
      params.push(renderParameter('nAnts', 'Number of Ants', 'number', 1, 50, 1));
      params.push(renderParameter('q0', 'Exploitation Probability (q0)', 'number', 0, 1, 0.01));
      params.push(renderParameter('rho', 'Evaporation Rate (ρ)', 'number', 0, 1, 0.01));
      params.push(renderParameter('evap', 'Best Solution Evaporation', 'number', 0, 0.1, 0.001));
    }
    
    if (algorithm === 2) {
      // DCM-ACO specific parameters
      params.push(renderParameter('numACS', 'Number of ACS Colonies', 'number', 1, 5, 1));
      params.push(renderParameter('convThresh', 'Convergence Threshold', 'number', 0, 1, 0.01));
      params.push(renderParameter('entropyThresh', 'Entropy Threshold', 'number', 0, 10, 0.1));
    }
    
    return params;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div 
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggleCollapse}
      >
        <h3 className="text-lg font-semibold text-gray-900">Solver Parameters</h3>
        <div className="text-gray-500">
          {isCollapsed ? '▼' : '▲'}
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {getAlgorithmParameters()}
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParameterPanel;
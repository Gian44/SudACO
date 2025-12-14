import React from 'react';
import { getAlgorithmNames } from '../utils/wasmBridge';

const AlgorithmSelector = ({ selectedAlgorithm, onAlgorithmChange }) => {
  const algorithmNames = getAlgorithmNames();

  const algorithms = [
    {
      id: 1,
      name: algorithmNames[1],
      description: 'Classic backtracking with constraint propagation. Guaranteed to find solution if it exists.',
      complexity: 'Exponential time, but very reliable'
    },
    {
      id: 0,
      name: algorithmNames[0],
      description: 'Single-colony Ant Colony Optimization (ACO). Uses pheromone trails to guide search.',
      complexity: 'Metaheuristic, good for medium difficulty puzzles'
    },
    {
      id: 2,
      name: algorithmNames[2],
      description: 'Multi-Colony DCM-ACO with dynamic collaborative mechanism. Advanced metaheuristic approach.',
      complexity: 'Most sophisticated, handles complex puzzles well'
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Algorithm</h3>
      <div className="space-y-3">
        {algorithms.map(algorithm => (
          <div key={algorithm.id} className="relative">
            <input
              type="radio"
              id={`algorithm-${algorithm.id}`}
              name="algorithm"
              value={algorithm.id}
              checked={selectedAlgorithm === algorithm.id}
              onChange={(e) => onAlgorithmChange(parseInt(e.target.value))}
              className="sr-only"
            />
            <label 
              htmlFor={`algorithm-${algorithm.id}`}
              className={`flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
              selectedAlgorithm === algorithm.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
            }`}>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                  selectedAlgorithm === algorithm.id
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {selectedAlgorithm === algorithm.id && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {algorithm.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {algorithm.description}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 italic">
                    {algorithm.complexity}
                  </div>
                </div>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlgorithmSelector;
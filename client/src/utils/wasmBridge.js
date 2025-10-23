// WebAssembly bridge for Sudoku solver
let wasmModule = null;

/**
 * Initialize the WebAssembly module
 * @returns {Promise<Object>} The WASM module instance
 */
export async function initWasm() {
  if (!wasmModule) {
    try {
      // Import the WASM module using standard ES6 import
      const wasmModuleFactory = await import('../wasm/sudoku_solver.js');
      wasmModule = await wasmModuleFactory.default();
      console.log('✓ WebAssembly module loaded successfully');
    } catch (error) {
      console.error('✗ Failed to load WebAssembly module:', error);
      throw new Error('Failed to load WebAssembly module. Please ensure sudoku_solver.js and sudoku_solver.wasm are in the src/wasm directory.');
    }
  }
  return wasmModule;
}

/**
 * Solve a Sudoku puzzle using the specified algorithm
 * @param {string} puzzleString - The puzzle as a string (dots for empty cells)
 * @param {number} algorithm - Algorithm type: 0=ACS, 1=Backtrack, 2=DCM-ACO
 * @param {Object} params - Algorithm parameters
 * @returns {Promise<Object>} Result object with success, solution, time, cellsFilled
 */
export async function solveSudoku(puzzleString, algorithm, params) {
  const module = await initWasm();
  
  try {
    // Call the WASM function
    const resultPtr = module.ccall(
      'solve_sudoku',
      'number', // returns pointer
      ['string', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [
        puzzleString,
        algorithm,
        params.nAnts || 4,
        params.numColonies || 3,
        params.numACS || 2,
        params.q0 || 0.9,
        params.rho || 0.9,
        params.evap || 0.005,
        params.convThresh || 0.8,
        params.entropyThresh || 4.0,
        params.timeout || 10.0
      ]
    );
    
    // Convert pointer to string
    const resultString = module.UTF8ToString(resultPtr);
    
    // Free the memory allocated by WASM
    module._free(resultPtr);
    
    // Parse JSON result
    const result = JSON.parse(resultString);
    
    // Debug: Log the raw result from WASM
    console.log('WASM Result:', resultString);
    console.log('Parsed result:', result);
    console.log('Time value:', result.time, 'Type:', typeof result.time);
    
    return result;
    
  } catch (error) {
    console.error('Error calling WASM solver:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred during solving'
    };
  }
}

/**
 * Get algorithm names for display
 * @returns {Object} Algorithm names mapped to IDs
 */
export function getAlgorithmNames() {
  return {
    0: 'Ant Colony System (ACS)',
    1: 'Backtracking Search',
    2: 'Multi-Colony DCM-ACO'
  };
}

/**
 * Get default parameters for each algorithm
 * @returns {Object} Default parameters for each algorithm
 */
export function getDefaultParameters() {
  return {
    0: { // ACS
      nAnts: 10,
      q0: 0.9,
      rho: 0.9,
      evap: 0.005,
      timeout: 10.0
    },
    1: { // Backtracking
      timeout: 10.0
    },
    2: { // DCM-ACO
      nAnts: 4,
      numColonies: 3,
      numACS: 2,
      q0: 0.9,
      rho: 0.9,
      evap: 0.005,
      convThresh: 0.8,
      entropyThresh: 4.0,
      timeout: 10.0
    }
  };
}

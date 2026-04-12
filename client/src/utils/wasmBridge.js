// WebAssembly bridge for Sudoku solver
let wasmModule = null;
const bundledWasmUrl = new URL('../wasm/sudoku_solver.wasm', import.meta.url).href;

function isNodeRuntime() {
  return typeof process !== 'undefined'
    && !!process.versions?.node
    && process.release?.name === 'node';
}

async function importWasmFactory() {
  const baseUrl = import.meta.env?.BASE_URL || '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const candidates = [
    new URL('../wasm/sudoku_solver.js', import.meta.url).href,
    `${normalizedBaseUrl}sudoku_solver.js`,
    '/sudoku_solver.js'
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      // Use explicit URL strings to avoid worker-relative path issues.
      // eslint-disable-next-line no-await-in-loop
      return await import(/* @vite-ignore */ candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to import sudoku_solver.js');
}

function normalizeSolutionString(solution) {
  if (typeof solution !== 'string') return solution;
  // Defensive cleanup in case solver output includes formatting/newlines.
  return solution.replace(/[\s|+\-]/g, '');
}

function parseSolverOutput(resultString) {
  const text = String(resultString ?? '').trim();
  if (!text) {
    return { success: false, error: 'Empty solver response' };
  }

  // Fast path: pure JSON response.
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      if ('solution' in parsed) {
        parsed.solution = normalizeSolutionString(parsed.solution);
      }
      return parsed;
    }
  } catch {
    // Fall back to mixed-output parsing below.
  }

  // Fallback: solver may emit verbose logs before/after JSON.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const jsonCandidate = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && typeof parsed === 'object') {
        if ('solution' in parsed) {
          parsed.solution = normalizeSolutionString(parsed.solution);
        }
        return {
          ...parsed,
          rawOutput: text
        };
      }
    } catch {
      // Continue to best-effort error return.
    }
  }

  return {
    success: false,
    error: 'Invalid solver response format',
    rawOutput: text
  };
}

// Default timeouts per puzzle size (seconds)
const TIMEOUT_DEFAULTS = {
  6: 3,
  9: 5,
  12: 10,
  16: 20,
  25: 120
};

function detectPuzzleSizeFromString(puzzleString) {
  const length = String(puzzleString || '').length;
  const size = Math.sqrt(length);
  return Number.isInteger(size) ? size : 9;
}

/**
 * Get the default timeout for a given puzzle size.
 * @param {number} size - Puzzle size (6, 9, 12, 16, or 25)
 * @returns {number} Default timeout in seconds
 */
export function getDefaultTimeout(size = 9) {
  return TIMEOUT_DEFAULTS[size] ?? 10.0;
}

/**
 * Initialize the WebAssembly module
 * @returns {Promise<Object>} The WASM module instance
 */
export async function initWasm() {
  if (!wasmModule) {
    const runningInBrowserLikeRuntime = !isNodeRuntime();
    const baseUrl = import.meta.env?.BASE_URL || '/';
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const originalProcess = globalThis.process;
    const needsProcessOverride = runningInBrowserLikeRuntime
      && originalProcess
      && originalProcess.versions?.node
      && originalProcess.type !== 'renderer';

    try {
      // Some generated loaders detect Node via global process. Force browser behavior in workers.
      if (needsProcessOverride) {
        globalThis.process = { ...originalProcess, type: 'renderer' };
      }
      const wasmModuleFactory = await importWasmFactory();
      wasmModule = await wasmModuleFactory.default({
        // Production bundles import a hashed JS wrapper from /assets/,
        // so always point to the matching bundled wasm artifact.
        locateFile: (path, scriptDirectory) => {
          if (path.endsWith('.wasm')) {
            return bundledWasmUrl;
          }
          return `${scriptDirectory}${path}`;
        }
      });
      console.log('✓ WebAssembly module loaded successfully');
    } catch (error) {
      console.error('✗ Failed to load WebAssembly module:', error);
      throw new Error('Failed to load WebAssembly module. Ensure sudoku_solver.js and sudoku_solver.wasm are bundled for production (recommended: commit them under client/src/wasm and/or client/public).');
    } finally {
      if (needsProcessOverride) {
        globalThis.process = originalProcess;
      }
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
    const {
      nAnts,
      numColonies,
      numACS,
      q0,
      rho,
      evap,
      convThresh,
      entropyThresh,
      timeout,
      xi
    } = resolveSolverArgs(puzzleString, algorithm, params);

    const resultPtr = callSolverFunction(module, 'solve_sudoku', {
      puzzleString,
      algorithm,
      nAnts,
      numColonies,
      numACS,
      q0,
      rho,
      evap,
      convThresh,
      entropyThresh,
      timeout,
      xi
    });
    
    // Convert pointer to string
    const resultString = module.UTF8ToString(resultPtr);
    
    // Free the memory allocated by WASM
    module._free(resultPtr);
    
    // Parse solver output defensively to support verbose/mixed outputs.
    const result = parseSolverOutput(resultString);
    
    return result;
    
  } catch (error) {
    console.error('Error calling WASM solver:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred during solving'
    };
  }
}

export async function solveSudokuWithProgress(puzzleString, algorithm, params) {
  const module = await initWasm();

  try {
    const {
      nAnts,
      numColonies,
      numACS,
      q0,
      rho,
      evap,
      convThresh,
      entropyThresh,
      timeout,
      xi
    } = resolveSolverArgs(puzzleString, algorithm, params);

    const resultPtr = callSolverFunction(module, 'solve_sudoku_with_progress', {
      puzzleString,
      algorithm,
      nAnts,
      numColonies,
      numACS,
      q0,
      rho,
      evap,
      convThresh,
      entropyThresh,
      timeout,
      xi
    });

    const resultString = module.UTF8ToString(resultPtr);
    module._free(resultPtr);
    return parseSolverOutput(resultString);
  } catch (error) {
    console.error('Error calling WASM solver with progress:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred during solving'
    };
  }
}

function resolveSolverArgs(puzzleString, algorithm, params) {
  const requested = params ?? {};
  const size = detectPuzzleSizeFromString(puzzleString);
  const timeoutDefault = getDefaultTimeout(size);
  const nAnts = requested.nAnts ?? (algorithm === 2 ? 3 : 10);
  const numACS = requested.numACS ?? 6;
  const numColonies = requested.numColonies ?? (numACS + 1);
  const q0 = requested.q0 ?? 0.9;
  const rho = requested.rho ?? 0.9;
  const evap = requested.evap ?? (algorithm === 2 ? 0.0125 : 0.005);
  const convThresh = requested.convThresh ?? 0.8;
  const xi = requested.xi ?? 0.1;
  const entropyPct = requested.entropyPct ?? 92.5;
  const entropyThresh = requested.entropyThresh ?? (Math.log2(nAnts) * (entropyPct / 100));
  const timeout = requested.timeout ?? timeoutDefault;

  return {
    nAnts,
    numACS,
    numColonies,
    q0,
    rho,
    evap,
    convThresh,
    entropyThresh,
    timeout,
    xi
  };
}

function callSolverFunction(module, functionName, args) {
  return module.ccall(
    functionName,
    'number',
    ['string', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
    [
      args.puzzleString,
      args.algorithm,
      args.nAnts,
      args.numColonies,
      args.numACS,
      args.q0,
      args.rho,
      args.evap,
      args.convThresh,
      args.entropyThresh,
      args.timeout,
      args.xi
    ]
  );
}

/**
 * Get algorithm names for display
 * @returns {Object} Algorithm names mapped to IDs
 */
export function getAlgorithmNames() {
  return {
    0: 'Ant Colony Optimization (ACO)',
    1: 'Backtracking Search',
    2: 'Multi-Colony DCM-ACO'
  };
}

/**
 * Get default parameters for each algorithm
 * @returns {Object} Default parameters for each algorithm
 */
export function getDefaultParameters(size = 9) {
  const timeout = getDefaultTimeout(size);
  const defaultNumACS = 6; // match solvermain
  const defaultNumColonies = defaultNumACS + 1; // n ACS + 1 MMAS

  return {
    0: { // ACS (match solvermain defaults)
      nAnts: 10,
      q0: 0.9,
      rho: 0.9,
      evap: 0.005,
      xi: 0.1,
      timeout
    },
    1: { // Backtracking
      timeout
    },
    2: { // DCM-ACO (match solvermain: numACS 2, entropyThresh 1.47)
      nAnts: 3,
      numColonies: defaultNumColonies,
      numACS: defaultNumACS,
      q0: 0.9,
      rho: 0.9,
      evap: 0.0125,
      convThresh: 0.8,
      entropyPct: 92.5,
      xi: 0.1,
      timeout
    }
  };
}

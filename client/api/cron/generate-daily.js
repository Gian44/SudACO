// Vercel Cron Job: Generate tomorrow's daily puzzle automatically
// Runs daily at midnight UTC (0 0 * * *)
import { kv } from '@vercel/kv';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Available sizes and difficulties
const SIZES = [6, 9, 12, 16, 25];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Fill percentages for each difficulty
const DIFFICULTY_FILL_PERCENT = {
  easy: 55,
  medium: 45,
  hard: 35
};

// Default timeouts per puzzle size (seconds)
const TIMEOUT_DEFAULTS = {
  6: 3,
  9: 5,
  12: 10,
  16: 20,
  25: 120
};

// WASM module cache
let wasmModule = null;

/**
 * Initialize WASM module
 */
async function initWasm() {
  if (!wasmModule) {
    try {
      // Try to load WASM from different possible locations
      // Vercel serverless functions have a different file structure
      // Priority: local wasm directory (for serverless), then other locations
      const possiblePaths = [
        join(__dirname, 'wasm', 'sudoku_solver.js'), // Best: local to API function
        join(process.cwd(), 'client', 'src', 'wasm', 'sudoku_solver.js'),
        join(process.cwd(), 'client', 'public', 'sudoku_solver.js'),
        join(process.cwd(), 'src', 'wasm', 'sudoku_solver.js'),
        join(__dirname, '..', '..', 'src', 'wasm', 'sudoku_solver.js'),
        join(__dirname, '..', '..', 'public', 'sudoku_solver.js'),
        join(__dirname, '..', '..', '..', 'client', 'src', 'wasm', 'sudoku_solver.js'),
        join(__dirname, '..', '..', '..', 'client', 'public', 'sudoku_solver.js'),
      ];

      let wasmModuleFactory = null;
      let lastError = null;
      
      for (const wasmPath of possiblePaths) {
        try {
          // For local wasm directory, use relative import (works in Vercel)
          if (wasmPath.includes('wasm/sudoku_solver.js') && wasmPath.startsWith(join(__dirname))) {
            wasmModuleFactory = await import('./wasm/sudoku_solver.js');
            console.log(`✓ Found WASM module at: ${wasmPath} (using relative import)`);
            break;
          }
          // Use pathToFileURL for other paths
          const wasmUrl = pathToFileURL(wasmPath).href;
          wasmModuleFactory = await import(wasmUrl);
          console.log(`✓ Found WASM module at: ${wasmPath}`);
          break;
        } catch (e) {
          lastError = e;
          continue;
        }
      }

      if (!wasmModuleFactory) {
        throw new Error(`Could not find WASM module. Last error: ${lastError?.message || 'unknown'}. Ensure sudoku_solver.js and sudoku_solver.wasm are in api/cron/wasm/ directory.`);
      }

      wasmModule = await wasmModuleFactory.default();
      console.log('✓ WebAssembly module loaded successfully');
    } catch (error) {
      console.error('✗ Failed to load WebAssembly module:', error.message);
      throw error;
    }
  }
  return wasmModule;
}

/**
 * Solve Sudoku using WASM
 */
async function solveSudoku(puzzleString, algorithm, params) {
  const module = await initWasm();
  
  try {
    const numACS = params.numACS ?? 3;
    const numColonies = params.numColonies ?? (numACS + 1);

    const resultPtr = module.ccall(
      'solve_sudoku',
      'number',
      ['string', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [
        puzzleString,
        algorithm,
        params.nAnts || 4,
        numColonies,
        numACS,
        params.q0 || 0.9,
        params.rho || 0.9,
        params.evap || 0.005,
        params.convThresh || 0.8,
        params.entropyThresh || 4.0,
        params.timeout || 10.0
      ]
    );
    
    const resultString = module.UTF8ToString(resultPtr);
    module._free(resultPtr);
    
    return JSON.parse(resultString);
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error occurred during solving'
    };
  }
}

/**
 * Get date string in ISO format
 */
function getDateISOString(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get date string in MMDDYYYY format
 */
function getDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${day}${year}`;
}

/**
 * Generate seed from string
 */
function stringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator
 */
function seededRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Get random size and difficulty for a specific date (deterministic)
 */
function getRandomSizeAndDifficulty(date) {
  const dateString = getDateISOString(date);
  const seed = stringToSeed(dateString);
  const random = seededRandom(seed);
  
  const sizeIndex = Math.floor(random() * SIZES.length);
  const difficultyIndex = Math.floor(random() * DIFFICULTIES.length);
  
  return {
    size: SIZES[sizeIndex],
    difficulty: DIFFICULTIES[difficultyIndex]
  };
}

/**
 * Generate daily puzzle filename
 */
function generateDailyFilename(dateStr, size, difficulty) {
  return `${dateStr}_${size}x${size}_${difficulty}.txt`;
}

/**
 * Create empty grid
 */
function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(''));
}

/**
 * Convert grid to string
 */
function gridToString(grid, size) {
  let result = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      result += (cell === '' || cell === null || cell === undefined) ? '.' : cell;
    }
  }
  return result;
}


/**
 * Remove cells randomly from filled board (deterministic with seed)
 */
function removeCellsRandomly(filledString, size, fillPercentage, randomFn) {
  const totalCells = size * size;
  const cellsToKeep = Math.floor((totalCells * fillPercentage) / 100);
  const cellsToRemove = totalCells - cellsToKeep;
  
  const puzzleArray = filledString.split('');
  const cellIndices = Array.from({ length: totalCells }, (_, i) => i);
  
  // Use seeded random for deterministic shuffling
  const shuffledIndices = seededFisherYatesShuffle(cellIndices, randomFn);
  const indicesToRemove = shuffledIndices.slice(0, cellsToRemove);
  
  indicesToRemove.forEach(index => {
    puzzleArray[index] = '.';
  });
  
  return puzzleArray.join('');
}

/**
 * Fisher-Yates shuffle with seeded random
 */
function seededFisherYatesShuffle(array, randomFn) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Convert puzzle string to instance file format
 */
function gridToInstanceFormat(puzzleString, size) {
  let content = '';
  
  // Line 1: Size or order
  if (size === 6 || size === 12) {
    content += `${size}\n`;
  } else if (size === 9) {
    content += '3\n';
  } else if (size === 16) {
    content += '4\n';
  } else if (size === 25) {
    content += '5\n';
  }
  
  // Line 2: Unused integer
  content += '1\n';
  
  // Lines 3+: Grid data
  for (let i = 0; i < size; i++) {
    const rowValues = [];
    for (let j = 0; j < size; j++) {
      const index = i * size + j;
      const cell = puzzleString[index];
      
      if (cell === '.' || cell === '') {
        rowValues.push('-1');
      } else {
        const charCode = cell.charCodeAt(0);
        let value;
        
        if (charCode >= 49 && charCode <= 57) { // '1'-'9'
          value = charCode - 48;
        } else if (charCode >= 65 && charCode <= 90) { // 'A'-'Z'
          value = charCode - 65 + 10;
        } else if (charCode >= 97 && charCode <= 122) { // 'a'-'z'
          value = charCode - 97 + 10;
        } else {
          value = -1;
        }
        
        rowValues.push(String(value));
      }
    }
    content += rowValues.join(' ') + '\n';
  }
  
  return content;
}

/**
 * Generate filled board
 */
async function generateFilledBoard(size, algorithm, params) {
  const emptyGrid = createEmptyGrid(size);
  const emptyString = gridToString(emptyGrid, size);
  
  const result = await solveSudoku(emptyString, algorithm, params);
  
  if (!result.success || !result.solution) {
    throw new Error(`Failed to generate filled board: ${result.error || 'Unknown error'}`);
  }
  
  return result.solution;
}

/**
 * Generate puzzle (deterministic based on date seed)
 */
async function generatePuzzle(size, algorithm, fillPercentage, params, dateSeed) {
  try {
    const filledString = await generateFilledBoard(size, algorithm, params);
    
    // Use seeded random for deterministic cell removal
    const seed = stringToSeed(dateSeed);
    const random = seededRandom(seed);
    const puzzleString = removeCellsRandomly(filledString, size, fillPercentage, random);
    
    const instanceContent = gridToInstanceFormat(puzzleString, size);
    
    return {
      success: true,
      puzzleString,
      instanceContent,
      filledString,
      size,
      fillPercentage
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get default parameters for DCM-ACO
 */
function getDefaultParameters(size) {
  const timeout = TIMEOUT_DEFAULTS[size] || 10;
  const defaultNumACS = 3;
  const defaultNumColonies = defaultNumACS + 1;
  
  return {
    0: { // ACS
      nAnts: 10,
      q0: 0.9,
      rho: 0.9,
      evap: 0.005,
      timeout
    },
    1: { // Backtracking
      timeout
    },
    2: { // DCM-ACO
      nAnts: 4,
      numColonies: defaultNumColonies,
      numACS: defaultNumACS,
      q0: 0.9,
      rho: 0.9,
      evap: 0.005,
      convThresh: 0.8,
      entropyThresh: 4.0,
      timeout: size <= 9 ? 15 : size <= 12 ? 45 : size <= 16 ? 90 : 180
    }
  };
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // Verify this is a cron job request
  // Vercel cron jobs can optionally use CRON_SECRET for authentication
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  // Also check for Vercel's cron header (user-agent contains "vercel-cron")
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent.includes('vercel-cron') && !process.env.CRON_SECRET) {
    // In production, you might want to be more strict
    // For now, allow manual testing
    console.warn('Request not from Vercel cron, but proceeding (set CRON_SECRET for production)');
  }

  try {
    // Generate puzzle for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dateISO = getDateISOString(tomorrow);
    const { size, difficulty } = getRandomSizeAndDifficulty(tomorrow);
    const fillPercent = DIFFICULTY_FILL_PERCENT[difficulty];
    const dateStr = getDateString(tomorrow);
    const filename = generateDailyFilename(dateStr, size, difficulty);
    
    console.log(`Generating daily puzzle for ${dateISO}: ${size}x${size} ${difficulty} (${fillPercent}% filled)`);
    
    // Check if puzzle already exists
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const puzzleKey = `daily-puzzle:${dateISO}`;
      const existing = await kv.get(puzzleKey);
      if (existing) {
        console.log(`Daily puzzle for ${dateISO} already exists, skipping generation`);
        return res.json({
          success: true,
          message: `Daily puzzle for ${dateISO} already exists`,
          filename,
          date: dateISO
        });
      }
    }
    
    // Get default parameters for DCM-ACO
    const params = getDefaultParameters(size)[2]; // 2 = DCM-ACO
    params.timeout = size <= 9 ? 15 : size <= 12 ? 45 : size <= 16 ? 90 : 180;
    
    // Generate the puzzle (pass dateISO for deterministic generation)
    const result = await generatePuzzle(size, 2, fillPercent, params, dateISO);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate daily puzzle');
    }
    
    const puzzleData = {
      filename,
      content: result.instanceContent,
      size,
      difficulty,
      puzzleString: result.puzzleString,
      date: dateISO,
      createdAt: new Date().toISOString()
    };
    
    // Save to Vercel KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const puzzleKey = `daily-puzzle:${dateISO}`;
      await kv.set(puzzleKey, JSON.stringify(puzzleData));
      
      // Add to daily puzzles list
      const listKey = 'daily-puzzles:list';
      const existingList = await kv.get(listKey) || [];
      if (!existingList.includes(filename)) {
        existingList.push(filename);
        await kv.set(listKey, existingList);
      }
      
      console.log(`Daily puzzle saved to KV: ${filename}`);
      
      return res.json({
        success: true,
        message: `Daily puzzle for ${dateISO} generated and saved`,
        filename,
        date: dateISO,
        size,
        difficulty,
        storage: 'vercel-kv'
      });
    } else {
      // KV not available (development)
      console.warn('KV not available, puzzle generated but not saved');
      return res.json({
        success: true,
        message: `Daily puzzle for ${dateISO} generated (KV not available)`,
        filename,
        date: dateISO,
        size,
        difficulty,
        warning: 'KV not configured, puzzle not saved'
      });
    }
    
  } catch (error) {
    console.error('Error generating daily puzzle:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

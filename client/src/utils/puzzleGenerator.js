// Puzzle generation utilities for creating Sudoku puzzles
import { solveSudoku, getDefaultParameters } from './wasmBridge';
import { createEmptyGrid, gridToString, stringToGrid } from './sudokuUtils';

/**
 * Generate a completely filled Sudoku board using the specified algorithm
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @param {number} algorithm - Algorithm to use (0=ACS, 1=Backtrack, 2=DCM-ACO)
 * @param {Object} params - Algorithm parameters
 * @returns {Promise<string>} Filled puzzle string
 */
export async function generateFilledBoard(size, algorithm, params) {
  try {
    // Create empty grid
    const emptyGrid = createEmptyGrid(size);
    const emptyString = gridToString(emptyGrid, size);
    
    // Use solver to fill the empty board
    const result = await solveSudoku(emptyString, algorithm, params);
    
    if (!result.success || !result.solution) {
      throw new Error(`Failed to generate filled board: ${result.error || 'Unknown error'}`);
    }
    
    return result.solution;
  } catch (error) {
    console.error('Error generating filled board:', error);
    throw new Error(`Failed to generate filled board: ${error.message}`);
  }
}

/**
 * Fisher-Yates shuffle algorithm for proper randomization
 * @param {Array} array - Array to shuffle
 * @param {Function} randomFn - Random function (0-1), defaults to Math.random
 * @returns {Array} Shuffled array
 */
function fisherYatesShuffle(array, randomFn = Math.random) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Remove cells randomly from a filled board to create a puzzle
 * @param {string} filledString - Completely filled puzzle string
 * @param {number} size - Grid size
 * @param {number} fillPercentage - Percentage of cells to keep filled (0-100)
 * @param {Function} randomFn - Optional seeded random function for deterministic generation
 * @returns {string} Puzzle string with cells removed
 */
export function removeCellsRandomly(filledString, size, fillPercentage, randomFn = Math.random) {
  const totalCells = size * size;
  const cellsToKeep = Math.floor((totalCells * fillPercentage) / 100);
  const cellsToRemove = totalCells - cellsToKeep;
  
  // Convert string to array for easier manipulation
  const puzzleArray = filledString.split('');
  
  // Create array of all cell indices
  const cellIndices = Array.from({ length: totalCells }, (_, i) => i);
  
  // Use Fisher-Yates shuffle for proper randomization (with optional seeded random)
  const shuffledIndices = fisherYatesShuffle(cellIndices, randomFn);
  const indicesToRemove = shuffledIndices.slice(0, cellsToRemove);
  
  // Remove selected cells (replace with dots)
  indicesToRemove.forEach(index => {
    puzzleArray[index] = '.';
  });
  
  return puzzleArray.join('');
}


/**
 * Convert puzzle string to instance file format
 * @param {string} puzzleString - Puzzle string with dots for empty cells
 * @param {number} size - Grid size
 * @returns {string} Instance file content
 */
export function gridToInstanceFormat(puzzleString, size) {
  // Convert puzzle string to 2D grid
  const grid = stringToGrid(puzzleString, size);
  
  let content = '';
  
  // Line 1: Size or order
  if (size === 6 || size === 12) {
    content += `${size}\n`;
  } else if (size === 9) {
    content += '3\n'; // order for 9x9
  } else if (size === 16) {
    content += '4\n'; // order for 16x16
  } else if (size === 25) {
    content += '5\n'; // order for 25x25
  }
  
  // Line 2: Unused integer
  content += '1\n';
  
  // Lines 3+: Grid data
  for (let row = 0; row < size; row++) {
    const rowValues = [];
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell === '' || cell === '.') {
        rowValues.push('-1');
      } else {
        // Convert display character to instance value (1-based)
        const value = parseInt(cell);
        if (!isNaN(value) && value >= 1 && value <= size) {
          rowValues.push(String(value));
        } else {
          // Handle larger grids with letters (A, B, C, etc.)
          if (cell >= 'A' && cell <= 'Z') {
            const letterValue = cell.charCodeAt(0) - 65 + 10; // A->10, B->11, etc.
            if (letterValue <= size) {
              rowValues.push(String(letterValue));
            } else {
              rowValues.push('-1'); // Fallback to empty
            }
          } else {
            rowValues.push('-1'); // Fallback to empty
          }
        }
      }
    }
    content += rowValues.join(' ') + '\n';
  }
  
  return content;
}

/**
 * Generate a complete puzzle with specified parameters
 * @param {number} size - Grid size
 * @param {number} algorithm - Algorithm to use
 * @param {number} fillPercentage - Percentage of cells to keep filled
 * @param {Object} params - Algorithm parameters
 * @param {Function} randomFn - Optional seeded random function for deterministic generation
 * @returns {Promise<Object>} Generated puzzle data
 */
export async function generatePuzzle(size, algorithm, fillPercentage, params, randomFn = null) {
  try {
    // Generate filled board
    const filledString = await generateFilledBoard(size, algorithm, params);
    
    // Remove cells to create puzzle (use seeded random if provided for deterministic generation)
    const puzzleString = removeCellsRandomly(filledString, size, fillPercentage, randomFn);
    
    // Convert to instance format
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
    console.error('Error generating puzzle:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

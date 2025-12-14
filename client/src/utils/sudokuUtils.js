// Sudoku utility functions for grid/string conversion and validation

/**
 * Get box dimensions for a given size
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {Object} {boxRows, boxCols}
 */
export function getBoxDimensions(size) {
  const dimensions = {
    6: { boxRows: 2, boxCols: 3 },
    9: { boxRows: 3, boxCols: 3 },
    12: { boxRows: 3, boxCols: 4 },
    16: { boxRows: 4, boxCols: 4 },
    25: { boxRows: 5, boxCols: 5 }
  };
  
  if (!dimensions[size]) {
    throw new Error(`Unsupported grid size: ${size}`);
  }
  
  return dimensions[size];
}

/**
 * Convert 2D grid array to puzzle string format
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle (display format)
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {string} Puzzle string with dots for empty cells (backend format)
 */
export function gridToString(grid, size) {
  let result = '';
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell === '' || cell === null || cell === undefined) {
        result += '.';
      } else {
        result += displayToBackend(cell, size);
      }
    }
  }
  
  return result;
}

/**
 * Convert backend character to display character
 * Backend uses 0-based with lowercase letters, display uses 1-based with uppercase
 * @param {string} backendChar - Character from backend
 * @param {number} size - Grid size
 * @returns {string} Display character
 */
function backendToDisplay(backendChar, size) {
  if (backendChar === '.' || backendChar === '') return '';
  
  if (size === 6 || size === 9) {
    return backendChar; // Already correct (1-9)
  } else if (size === 12) {
    // Backend: '0'-'9', 'a', 'b' -> Display: '1'-'12'
    const charCode = backendChar.charCodeAt(0);
    if (charCode >= 48 && charCode <= 57) { // '0'-'9'
      return String(charCode - 48 + 1); // '0'->1, '1'->2, ..., '9'->10
    } else if (backendChar >= 'a' && backendChar <= 'b') {
      return String(11 + backendChar.charCodeAt(0) - 97); // 'a'->11, 'b'->12
    }
  } else if (size === 16) {
    // Backend: '0'-'9', 'a'-'f' -> Display: '1'-'16'
    const charCode = backendChar.charCodeAt(0);
    if (charCode >= 48 && charCode <= 57) { // '0'-'9'
      return String(charCode - 48 + 1); // '0'->1, ..., '9'->10
    } else if (backendChar >= 'a' && backendChar <= 'f') {
      return String(11 + backendChar.charCodeAt(0) - 97); // 'a'->11, ..., 'f'->16
    }
  } else if (size === 25) {
    // Backend: 'a'-'y' -> Display: '1'-'25'
    return String(backendChar.charCodeAt(0) - 97 + 1); // 'a'->1, 'b'->2, ..., 'y'->25
  }
  
  return backendChar; // Fallback
}

/**
 * Convert display character to backend character
 * @param {string} displayChar - Character from display
 * @param {number} size - Grid size
 * @returns {string} Backend character
 */
function displayToBackend(displayChar, size) {
  if (displayChar === '' || displayChar === '.') return '.';
  
  const num = parseInt(displayChar);
  if (isNaN(num) || num < 1 || num > size) {
    return '.'; // Invalid, treat as empty
  }
  
  if (size === 6 || size === 9) {
    return displayChar; // Already correct (1-9)
  } else if (size === 12) {
    // Display: '1'-'12' -> Backend: '0'-'9', 'a', 'b'
    if (num <= 10) {
      return String(num - 1); // 1->0, 2->1, ..., 10->9
    } else {
      return String.fromCharCode(97 + num - 11); // 11->a, 12->b
    }
  } else if (size === 16) {
    // Display: '1'-'16' -> Backend: '0'-'9', 'a'-'f'
    if (num <= 10) {
      return String(num - 1); // 1->0, ..., 10->9
    } else {
      return String.fromCharCode(97 + num - 11); // 11->a, ..., 16->f
    }
  } else if (size === 25) {
    // Display: '1'-'25' -> Backend: 'a'-'y'
    return String.fromCharCode(97 + num - 1); // 1->a, 2->b, ..., 25->y
  }
  
  return displayChar; // Fallback
}

/**
 * Convert puzzle string to 2D grid array
 * @param {string} puzzleString - Puzzle string with dots for empty cells (backend format)
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {Array<Array<string>>} 2D array representing the puzzle (display format)
 */
export function stringToGrid(puzzleString, size) {
  const grid = [];
  
  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      const index = row * size + col;
      const char = puzzleString[index];
      grid[row][col] = backendToDisplay(char, size);
    }
  }
  
  return grid;
}

/**
 * Create empty grid for given size
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {Array<Array<string>>} Empty 2D array
 */
export function createEmptyGrid(size) {
  const grid = [];
  
  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      grid[row][col] = '';
    }
  }
  
  return grid;
}

/**
 * Validate grid for basic format issues
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {Object} Validation result with isValid and errors
 */
export function validateGrid(grid, size) {
  const errors = [];
  
  // Check grid dimensions
  if (!grid || grid.length !== size) {
    errors.push(`Grid must have ${size} rows`);
    return { isValid: false, errors };
  }
  
  for (let row = 0; row < size; row++) {
    if (!grid[row] || grid[row].length !== size) {
      errors.push(`Row ${row} must have ${size} columns`);
      return { isValid: false, errors };
    }
  }
  
  // Check for invalid characters
  const validChars = getValidCharacters(size);
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      if (cell !== '' && !validChars.includes(cell)) {
        errors.push(`Invalid character '${cell}' at row ${row}, col ${col}. Valid characters: ${validChars.join(', ')}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get valid characters for given size
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {Array<string>} Array of valid characters (as strings, may be multi-char)
 */
export function getValidCharacters(size) {
  const chars = [];
  for (let i = 1; i <= size; i++) {
    chars.push(String(i));
  }
  return chars;
}

/**
 * Detect puzzle size from string length
 * @param {string} puzzleString - Puzzle string
 * @returns {number|null} Detected size or null if invalid
 */
export function getPuzzleSizeFromString(puzzleString) {
  const length = puzzleString.length;
  
  if (length === 36) return 6;   // 6x6
  if (length === 81) return 9;   // 9x9
  if (length === 144) return 12; // 12x12
  if (length === 256) return 16; // 16x16
  if (length === 625) return 25; // 25x25
  
  return null;
}

/**
 * Convert instance format values to puzzle string characters
 * @param {Array<Array<number>>} values - 2D array with -1 for empty, 1-based values for filled
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {string} Puzzle string
 */
export function instanceFormatToString(values, size) {
  let result = '';
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = values[row][col];
      
      if (value === -1) {
        result += '.';
      } else if (value >= 1 && value <= size) {
        result += instanceValueToChar(value, size);
      } else {
        throw new Error(`Invalid value: ${value}`);
      }
    }
  }
  
  return result;
}

/**
 * Convert instance value to character (helper function)
 * @param {number} value - 1-based value
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {string} Character
 */
function instanceValueToChar(value, size) {
  if (size === 6) {
    return String(value);  // 1-6 -> '1'-'6'
  } else if (size === 9) {
    return String(value);  // 1-9 -> '1'-'9'
  } else if (size === 12) {
    if (value <= 9) {
      return String(value);  // 1-9 -> '1'-'9'
    } else {
      return String.fromCharCode(65 + value - 10);  // 10-12 -> 'A'-'C'
    }
  } else if (size === 16) {
    if (value <= 9) {
      return String(value);  // 1-9 -> '1'-'9'
    } else {
      return String.fromCharCode(65 + value - 10);  // 10-16 -> 'A'-'G'
    }
  } else if (size === 25) {
    if (value <= 9) {
      return String(value);  // 1-9 -> '1'-'9'
    } else {
      return String.fromCharCode(65 + value - 10);  // 10-25 -> 'A'-'P'
    }
  }
  
  throw new Error(`Unsupported size: ${size}`);
}

/**
 * Get puzzle size display name
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {string} Display name
 */
export function getPuzzleSizeName(size) {
  return `${size}×${size}`;
}

/**
 * Count filled cells in grid
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle
 * @returns {number} Number of filled cells
 */
export function countFilledCells(grid) {
  let count = 0;
  
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== '') {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Find all conflicts in the grid
 * Returns cells that have the same value in their row, column, or box
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle
 * @param {number} size - Grid size
 * @returns {Set<string>} Set of conflicting cell keys in "row-col" format
 */
export function findConflicts(grid, size) {
  const conflicts = new Set();
  const { boxRows, boxCols } = getBoxDimensions(size);
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = grid[row][col];
      if (value === '') continue;
      
      // Check row
      for (let c = 0; c < size; c++) {
        if (c !== col && grid[row][c] === value) {
          conflicts.add(`${row}-${col}`);
          conflicts.add(`${row}-${c}`);
        }
      }
      
      // Check column
      for (let r = 0; r < size; r++) {
        if (r !== row && grid[r][col] === value) {
          conflicts.add(`${row}-${col}`);
          conflicts.add(`${r}-${col}`);
        }
      }
      
      // Check box
      const boxRowStart = Math.floor(row / boxRows) * boxRows;
      const boxColStart = Math.floor(col / boxCols) * boxCols;
      
      for (let r = boxRowStart; r < boxRowStart + boxRows; r++) {
        for (let c = boxColStart; c < boxColStart + boxCols; c++) {
          if ((r !== row || c !== col) && grid[r][c] === value) {
            conflicts.add(`${row}-${col}`);
            conflicts.add(`${r}-${c}`);
          }
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Check if a specific cell has a conflict
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} size - Grid size
 * @returns {boolean} True if cell has a conflict
 */
export function hasCellConflict(grid, row, col, size) {
  const value = grid[row][col];
  if (value === '') return false;
  
  const { boxRows, boxCols } = getBoxDimensions(size);
  
  // Check row
  for (let c = 0; c < size; c++) {
    if (c !== col && grid[row][c] === value) {
      return true;
    }
  }
  
  // Check column
  for (let r = 0; r < size; r++) {
    if (r !== row && grid[r][col] === value) {
      return true;
    }
  }
  
  // Check box
  const boxRowStart = Math.floor(row / boxRows) * boxRows;
  const boxColStart = Math.floor(col / boxCols) * boxCols;
  
  for (let r = boxRowStart; r < boxRowStart + boxRows; r++) {
    for (let c = boxColStart; c < boxColStart + boxCols; c++) {
      if ((r !== row || c !== col) && grid[r][c] === value) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if the puzzle is completely and correctly solved
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle
 * @param {number} size - Grid size
 * @returns {boolean} True if puzzle is solved
 */
export function isPuzzleSolved(grid, size) {
  // Check if all cells are filled
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col] === '') {
        return false;
      }
    }
  }
  
  // Check for any conflicts
  const conflicts = findConflicts(grid, size);
  return conflicts.size === 0;
}

/**
 * Count how many of each number are placed in the grid
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle
 * @param {number} size - Grid size
 * @returns {Object} Map of number to count
 */
export function countNumbers(grid, size) {
  const counts = {};
  for (let i = 1; i <= size; i++) {
    counts[String(i)] = 0;
  }
  
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = grid[row][col];
      if (value !== '' && counts[value] !== undefined) {
        counts[value]++;
      }
    }
  }
  
  return counts;
}

/**
 * Get numbers that have all instances placed (completed)
 * @param {Array<Array<string>>} grid - 2D array representing the puzzle
 * @param {number} size - Grid size
 * @returns {number[]} Array of completed numbers
 */
export function getCompletedNumbers(grid, size) {
  const counts = countNumbers(grid, size);
  const completed = [];
  
  for (let i = 1; i <= size; i++) {
    if (counts[String(i)] === size) {
      completed.push(i);
    }
  }
  
  return completed;
}

/**
 * Create empty notes grid
 * @param {number} size - Grid size
 * @returns {Array<Array<Set<number>>>} 2D array of Sets for notes
 */
export function createEmptyNotesGrid(size) {
  const notes = [];
  for (let row = 0; row < size; row++) {
    notes[row] = [];
    for (let col = 0; col < size; col++) {
      notes[row][col] = new Set();
    }
  }
  return notes;
}

/**
 * Toggle a note in a cell
 * @param {Array<Array<Set<number>>>} notes - Notes grid
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} value - Value to toggle
 * @returns {Array<Array<Set<number>>>} Updated notes grid
 */
export function toggleNote(notes, row, col, value) {
  const newNotes = notes.map(r => r.map(c => new Set(c)));
  if (newNotes[row][col].has(value)) {
    newNotes[row][col].delete(value);
  } else {
    newNotes[row][col].add(value);
  }
  return newNotes;
}

/**
 * Clear notes for a cell
 * @param {Array<Array<Set<number>>>} notes - Notes grid
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {Array<Array<Set<number>>>} Updated notes grid
 */
export function clearCellNotes(notes, row, col) {
  const newNotes = notes.map(r => r.map(c => new Set(c)));
  newNotes[row][col].clear();
  return newNotes;
}

/**
 * Remove a value from notes in related cells (same row, column, box)
 * @param {Array<Array<Set<number>>>} notes - Notes grid
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} value - Value to remove
 * @param {number} size - Grid size
 * @returns {Array<Array<Set<number>>>} Updated notes grid
 */
export function removeNoteFromRelatedCells(notes, row, col, value, size) {
  const newNotes = notes.map(r => r.map(c => new Set(c)));
  const { boxRows, boxCols } = getBoxDimensions(size);
  
  // Remove from row
  for (let c = 0; c < size; c++) {
    newNotes[row][c].delete(value);
  }
  
  // Remove from column
  for (let r = 0; r < size; r++) {
    newNotes[r][col].delete(value);
  }
  
  // Remove from box
  const boxRowStart = Math.floor(row / boxRows) * boxRows;
  const boxColStart = Math.floor(col / boxCols) * boxCols;
  
  for (let r = boxRowStart; r < boxRowStart + boxRows; r++) {
    for (let c = boxColStart; c < boxColStart + boxCols; c++) {
      newNotes[r][c].delete(value);
    }
  }
  
  return newNotes;
}
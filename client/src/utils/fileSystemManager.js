// File system management utilities for puzzle generation
import { getAlgorithmNames } from './wasmBridge';

// Local storage key for generated puzzles
const GENERATED_PUZZLES_KEY = 'sudoku_generated_puzzles';

/**
 * Get generated puzzles from local storage
 * @returns {Object} Generated puzzles data
 */
export function getGeneratedPuzzles() {
  try {
    const data = localStorage.getItem(GENERATED_PUZZLES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading generated puzzles:', error);
    return {};
  }
}

/**
 * Save generated puzzles to local storage
 * @param {Object} puzzles - Puzzles data to save
 */
export function saveGeneratedPuzzles(puzzles) {
  try {
    localStorage.setItem(GENERATED_PUZZLES_KEY, JSON.stringify(puzzles));
  } catch (error) {
    console.error('Error saving generated puzzles:', error);
  }
}

/**
 * Add a new generated puzzle to local storage
 * @param {string} category - Category name
 * @param {number} size - Grid size
 * @param {number} fillPercent - Fill percentage
 * @param {string} filename - Puzzle filename
 * @param {string} content - Puzzle file content
 * @param {string} puzzleString - Puzzle string for loading
 */
export function addGeneratedPuzzle(category, size, fillPercent, filename, content, puzzleString) {
  const puzzles = getGeneratedPuzzles();
  
  if (!puzzles[category]) {
    puzzles[category] = {};
  }
  
  if (!puzzles[category][`${size}x${size}`]) {
    puzzles[category][`${size}x${size}`] = {};
  }
  
  if (!puzzles[category][`${size}x${size}`][String(fillPercent)]) {
    puzzles[category][`${size}x${size}`][String(fillPercent)] = [];
  }
  
  // Add puzzle data
  puzzles[category][`${size}x${size}`][String(fillPercent)].push({
    filename,
    content,
    puzzleString,
    generatedAt: new Date().toISOString()
  });
  
  saveGeneratedPuzzles(puzzles);
  return puzzles;
}

/**
 * Get the next puzzle number for a given category, size, and fill percentage
 * @param {string} category - Category name (e.g., '6x6', 'general')
 * @param {number} size - Grid size
 * @param {number} fillPercent - Fill percentage
 * @param {Object} indexData - Current index.json data
 * @returns {number} Next puzzle number
 */
export function getNextPuzzleNumber(category, size, fillPercent, indexData) {
  const pattern = `inst${size}x${size}_${fillPercent}_`;
  
  let existingNumbers = [];
  
  // Check both index.json and local storage
  const generatedPuzzles = getGeneratedPuzzles();
  
  // Check index.json
  if (category === 'general') {
    // For general category, check nested structure
    const sizeKey = `${size}x${size}`;
    const percentKey = String(fillPercent);
    
    if (indexData.general && indexData.general[sizeKey] && indexData.general[sizeKey][percentKey]) {
      const files = indexData.general[sizeKey][percentKey];
      existingNumbers = files
        .filter(file => file.startsWith(pattern))
        .map(file => {
          const match = file.match(new RegExp(pattern + '(\\d+)\\.txt'));
          return match ? parseInt(match[1]) : -1;
        })
        .filter(num => num >= 0);
    }
  } else {
    // For simple categories (6x6, 12x12, logic-solvable)
    if (indexData[category] && Array.isArray(indexData[category])) {
      const files = indexData[category];
      existingNumbers = files
        .filter(file => file.startsWith(pattern))
        .map(file => {
          const match = file.match(new RegExp(pattern + '(\\d+)\\.txt'));
          return match ? parseInt(match[1]) : -1;
        })
        .filter(num => num >= 0);
    }
  }
  
  // Check local storage
  if (generatedPuzzles[category] && generatedPuzzles[category][`${size}x${size}`] && generatedPuzzles[category][`${size}x${size}`][String(fillPercent)]) {
    const localFiles = generatedPuzzles[category][`${size}x${size}`][String(fillPercent)];
    const localNumbers = localFiles
      .map(puzzle => puzzle.filename)
      .filter(file => file.startsWith(pattern))
      .map(file => {
        const match = file.match(new RegExp(pattern + '(\\d+)\\.txt'));
        return match ? parseInt(match[1]) : -1;
      })
      .filter(num => num >= 0);
    
    existingNumbers = [...existingNumbers, ...localNumbers];
  }
  
  // Return next number (0 if no existing files, max + 1 otherwise)
  return existingNumbers.length === 0 ? 0 : Math.max(...existingNumbers) + 1;
}

/**
 * Generate puzzle filename following the naming convention
 * @param {number} size - Grid size
 * @param {number} fillPercent - Fill percentage
 * @param {number} number - Puzzle number
 * @returns {string} Generated filename
 */
export function generatePuzzleFilename(size, fillPercent, number) {
  return `inst${size}x${size}_${fillPercent}_${number}.txt`;
}

/**
 * Download puzzle file with suggested filename
 * @param {string} filename - Filename for the download
 * @param {string} content - File content
 * @param {string} category - Category folder name
 */
export function savePuzzleFile(filename, content, category) {
  try {
    // Create blob with file content
    const blob = new Blob([content], { type: 'text/plain' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Set suggested directory path (browsers may ignore this)
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`Downloaded puzzle: ${filename}`);
    console.log(`Please save it to: client/public/instances/${category}/${filename}`);
    
    return {
      success: true,
      filename,
      suggestedPath: `client/public/instances/${category}/${filename}`
    };
  } catch (error) {
    console.error('Error downloading file:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update index.json data structure with new puzzle
 * @param {Object} indexData - Current index data
 * @param {string} category - Category name
 * @param {number} size - Grid size
 * @param {number} fillPercent - Fill percentage
 * @param {string} filename - New puzzle filename
 * @returns {Object} Updated index data
 */
export function updateIndexJson(indexData, category, size, fillPercent, filename) {
  const updatedData = { ...indexData };
  
  if (category === 'general') {
    // Handle general category nested structure
    const sizeKey = `${size}x${size}`;
    const percentKey = String(fillPercent);
    
    if (!updatedData.general) {
      updatedData.general = {};
    }
    if (!updatedData.general[sizeKey]) {
      updatedData.general[sizeKey] = {};
    }
    if (!updatedData.general[sizeKey][percentKey]) {
      updatedData.general[sizeKey][percentKey] = [];
    }
    
    // Add filename to the array
    updatedData.general[sizeKey][percentKey].push(filename);
  } else {
    // Handle simple categories
    if (!updatedData[category]) {
      updatedData[category] = [];
    }
    
    // Add filename to the array
    updatedData[category].push(filename);
  }
  
  return updatedData;
}

/**
 * Get algorithm options for puzzle generation
 * @returns {Array} Array of algorithm options
 */
export function getGenerationAlgorithmOptions() {
  const algorithms = getAlgorithmNames();
  return [
    { value: 2, label: algorithms[2] + ' (Recommended)' }, // DCM-ACO
    { value: 1, label: algorithms[1] }, // Backtracking
    { value: 0, label: algorithms[0] }, // ACS
  ];
}

/**
 * Get fill percentage options (0-100% in 5% increments)
 * @returns {Array} Array of percentage options
 */
export function getFillPercentageOptions() {
  const options = [];
  for (let i = 0; i <= 100; i += 5) {
    options.push({
      value: i,
      label: `${i}%`
    });
  }
  return options;
}

/**
 * Determine category from size
 * @param {number} size - Grid size
 * @returns {string} Category name
 */
export function getCategoryFromSize(size) {
  if (size === 6) return '6x6';
  if (size === 12) return '12x12';
  if (size === 9 || size === 16 || size === 25) return 'general';
  return 'general'; // Default fallback
}

// Load a random puzzle from the library (9x9, 16x16, 25x25)

import { parseInstanceFile } from './fileParser';
import { stringToGrid } from './sudokuUtils';
import { calculateDifficulty } from './dailyPuzzleService';
import { loadPuzzlesFromServer, checkServerHealth } from './apiClient';

/**
 * Get flat list of { category, file } from index/categories
 * Supports flat index { "9x9": [...], "16x16": [...] }
 * @param {Object} categories
 * @returns {Array<{category: string, file: string}>}
 */
function flattenPuzzleIndex(categories) {
  const result = [];
  if (!categories || typeof categories !== 'object') return result;

  for (const [key, value] of Object.entries(categories)) {
    if (key === 'daily-puzzles') continue;
    if (Array.isArray(value)) {
      value.forEach(file => result.push({ category: key, file }));
    } else if (value && typeof value === 'object') {
      // Nested: general -> size -> fillPercent -> files
      for (const [sizeKey, sizeData] of Object.entries(value)) {
        if (sizeData && typeof sizeData === 'object' && !Array.isArray(sizeData)) {
          for (const files of Object.values(sizeData)) {
            if (Array.isArray(files)) {
              files.forEach(file => result.push({ category: sizeKey, file }));
            }
          }
        } else if (Array.isArray(sizeData)) {
          sizeData.forEach(file => result.push({ category: sizeKey, file }));
        }
      }
    }
  }
  return result;
}

/**
 * Load a random puzzle from the library
 * @returns {Promise<Object|null>} Puzzle data { grid, size, puzzleString, difficulty, isDaily: false, puzzleKey } or null
 */
export async function loadRandomLibraryPuzzle() {
  let categories = {};
  try {
    const serverOk = await checkServerHealth();
    if (serverOk) {
      categories = await loadPuzzlesFromServer();
    } else {
      const response = await fetch('/instances/index.json');
      if (response.ok) {
        categories = await response.json();
      }
    }
  } catch (e) {
    console.warn('Failed to load puzzle index:', e);
    try {
      const response = await fetch('/instances/index.json');
      if (response.ok) categories = await response.json();
    } catch (e2) {
      console.warn('Fallback index fetch failed:', e2);
    }
  }

  const flat = flattenPuzzleIndex(categories);
  if (flat.length === 0) return null;

  const { category, file } = flat[Math.floor(Math.random() * flat.length)];

  let fileContent = null;
  try {
    const response = await fetch(`/api/puzzles/load?category=${encodeURIComponent(category)}&file=${encodeURIComponent(file)}`);
    if (response.ok) {
      fileContent = await response.text();
    }
  } catch {
    // Fallback to direct fetch
  }
  if (!fileContent) {
    try {
      const response = await fetch(`/instances/${category}/${file}`);
      if (response.ok) fileContent = await response.text();
    } catch (e) {
      console.warn('Failed to load puzzle file:', e);
      return null;
    }
  }

  if (!fileContent) return null;

  try {
    const { size, puzzleString } = parseInstanceFile(fileContent);
    const grid = stringToGrid(puzzleString, size);
    const difficulty = calculateDifficulty(puzzleString, size);
    const puzzleKey = `library-${category}-${file}`;

    return {
      grid,
      size,
      puzzleString,
      difficulty,
      isDaily: false,
      puzzleKey,
      fileName: file
    };
  } catch (e) {
    console.warn('Failed to parse puzzle:', e);
    return null;
  }
}

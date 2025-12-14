// Daily Puzzle Service
// Generates ONE random daily puzzle with randomized size and difficulty
// Saves to "daily-puzzles" folder following the same pattern as user-created puzzles

import { generatePuzzle } from './puzzleGenerator';
import { savePuzzleToServer, checkServerHealth } from './apiClient';
import { getDefaultParameters } from './wasmBridge';

// Available sizes and difficulties
const SIZES = [6, 9, 12, 16, 25];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Fill percentages for each difficulty
const DIFFICULTY_FILL_PERCENT = {
  easy: 55,    // 55% filled - easier puzzle
  medium: 45,  // 45% filled - moderate difficulty
  hard: 35     // 35% filled - harder puzzle
};

/**
 * Get today's date string in MMDDYYYY format for filename
 * @returns {string} Date string like "12142025"
 */
function getTodayDateString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  return `${month}${day}${year}`;
}

/**
 * Get today's date in ISO format for cache key
 * @returns {string} Date string like "2025-12-14"
 */
function getTodayISOString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Simple seeded random number generator
 * @param {number} seed - Seed value
 * @returns {Function} Random function returning 0-1
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
 * Generate a seed from a string
 * @param {string} str - Input string
 * @returns {number} Seed value
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
 * Generate the daily puzzle filename
 * @param {string} dateStr - Date string (MMDDYYYY)
 * @param {number} size - Puzzle size
 * @param {string} difficulty - Difficulty level
 * @returns {string} Filename like "12142025_9x9_medium.txt"
 */
function generateDailyFilename(dateStr, size, difficulty) {
  return `${dateStr}_${size}x${size}_${difficulty}.txt`;
}

/**
 * Get random size and difficulty for today (deterministic based on date)
 * @returns {Object} { size, difficulty }
 */
function getRandomSizeAndDifficulty() {
  const dateString = getTodayISOString();
  const seed = stringToSeed(dateString);
  const random = seededRandom(seed);
  
  // Pick random size and difficulty based on date seed
  const sizeIndex = Math.floor(random() * SIZES.length);
  const difficultyIndex = Math.floor(random() * DIFFICULTIES.length);
  
  return {
    size: SIZES[sizeIndex],
    difficulty: DIFFICULTIES[difficultyIndex]
  };
}

/**
 * Check if today's daily puzzle already exists
 * @returns {Object|null} Cached puzzle data or null
 */
function getCachedDailyPuzzle() {
  const dateISO = getTodayISOString();
  const cacheKey = `daily-puzzle-${dateISO}`;
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Failed to read daily puzzle from cache:', e);
  }
  
  return null;
}

/**
 * Save daily puzzle to cache
 * @param {Object} puzzleData - Puzzle data to cache
 */
function cacheDailyPuzzle(puzzleData) {
  const dateISO = getTodayISOString();
  const cacheKey = `daily-puzzle-${dateISO}`;
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify(puzzleData));
  } catch (e) {
    console.warn('Failed to cache daily puzzle:', e);
  }
}

/**
 * Generate and save the daily puzzle
 * Uses DCM-ACO (algorithm 2) for generation
 * @returns {Promise<Object>} Puzzle data
 */
async function generateAndSaveDailyPuzzle() {
  const { size, difficulty } = getRandomSizeAndDifficulty();
  const fillPercent = DIFFICULTY_FILL_PERCENT[difficulty];
  const dateStr = getTodayDateString();
  const filename = generateDailyFilename(dateStr, size, difficulty);
  
  console.log(`Generating daily puzzle: ${size}x${size} ${difficulty} (${fillPercent}% filled)`);
  
  // Get default parameters for DCM-ACO
  const params = getDefaultParameters(size)[2]; // 2 = DCM-ACO
  
  // Use longer timeout for generation
  params.timeout = size <= 9 ? 15 : size <= 12 ? 45 : size <= 16 ? 90 : 180;
  
  // Generate the puzzle using the same method as puzzleGenerator
  const result = await generatePuzzle(size, 2, fillPercent, params);
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to generate daily puzzle');
  }
  
  const puzzleData = {
    puzzleString: result.puzzleString,
    solutionString: result.filledString,
    instanceContent: result.instanceContent,
    size,
    difficulty,
    fillPercent,
    filename,
    date: getTodayISOString(),
    dateCreated: dateStr,
    source: 'daily',
    isDaily: true
  };
  
  // Try to save to server (daily-puzzles folder)
  try {
    const serverOk = await checkServerHealth();
    if (serverOk) {
      // Save to daily-puzzles category
      await saveDailyPuzzleToServer(puzzleData);
      console.log(`Daily puzzle saved to server: ${filename}`);
    }
  } catch (e) {
    console.warn('Could not save daily puzzle to server:', e);
  }
  
  return puzzleData;
}

/**
 * Save daily puzzle to server in daily-puzzles folder
 * @param {Object} puzzleData - Puzzle data
 */
async function saveDailyPuzzleToServer(puzzleData) {
  try {
    const response = await fetch('/api/puzzles/save-daily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: puzzleData.filename,
        content: puzzleData.instanceContent,
        size: puzzleData.size,
        difficulty: puzzleData.difficulty
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.warn('Failed to save daily puzzle to server:', error);
    // Don't throw - saving to server is optional
  }
}

/**
 * Get today's daily puzzle
 * Creates one if it doesn't exist, otherwise returns cached version
 * @returns {Promise<Object>} Puzzle data
 */
export async function getDailyPuzzle() {
  // Check if we already have today's puzzle
  const cached = getCachedDailyPuzzle();
  if (cached) {
    console.log('Loaded daily puzzle from cache:', cached.filename);
    return cached;
  }
  
  // Generate new daily puzzle
  console.log('Generating new daily puzzle...');
  const puzzleData = await generateAndSaveDailyPuzzle();
  
  // Cache it
  cacheDailyPuzzle(puzzleData);
  
  return puzzleData;
}

/**
 * Check if the daily puzzle has been completed today
 * @returns {boolean} True if completed
 */
export function isDailyCompleted() {
  const dateISO = getTodayISOString();
  const key = `daily-completed-${dateISO}`;
  return localStorage.getItem(key) === 'true';
}

/**
 * Mark the daily puzzle as completed
 * @param {number} timeSeconds - Time taken to solve in seconds
 */
export function markDailyCompleted(timeSeconds) {
  const dateISO = getTodayISOString();
  const key = `daily-completed-${dateISO}`;
  localStorage.setItem(key, 'true');
  
  const timeKey = `daily-time-${dateISO}`;
  localStorage.setItem(timeKey, String(timeSeconds));
}

/**
 * Get the completion time for today's puzzle
 * @returns {number|null} Time in seconds or null if not completed
 */
export function getDailyCompletionTime() {
  const dateISO = getTodayISOString();
  const key = `daily-time-${dateISO}`;
  const time = localStorage.getItem(key);
  return time ? parseInt(time) : null;
}

/**
 * Calculate puzzle difficulty based on fill percentage
 * @param {string} puzzleString - Puzzle string
 * @param {number} size - Grid size
 * @returns {string} Difficulty level ('easy', 'medium', 'hard')
 */
export function calculateDifficulty(puzzleString, size) {
  const totalCells = size * size;
  const filledCells = puzzleString.replace(/\./g, '').length;
  const fillPercentage = (filledCells / totalCells) * 100;
  
  if (fillPercentage >= 50) return 'easy';
  if (fillPercentage >= 40) return 'medium';
  return 'hard';
}

/**
 * Get difficulty display info
 * @param {string} difficulty - Difficulty level
 * @returns {Object} Display info with label and color class
 */
export function getDifficultyInfo(difficulty) {
  const info = {
    easy: { label: 'Easy', className: 'difficulty-easy', stars: 1 },
    medium: { label: 'Medium', className: 'difficulty-medium', stars: 2 },
    hard: { label: 'Hard', className: 'difficulty-hard', stars: 3 }
  };
  return info[difficulty] || info.medium;
}

/**
 * Get today's daily puzzle info without loading the full puzzle
 * Useful for displaying in the puzzle selection modal
 * @returns {Object|null} Basic info about today's puzzle
 */
export function getDailyPuzzleInfo() {
  const cached = getCachedDailyPuzzle();
  if (cached) {
    return {
      size: cached.size,
      difficulty: cached.difficulty,
      filename: cached.filename,
      isCompleted: isDailyCompleted()
    };
  }
  
  // Return predicted info based on date seed
  const { size, difficulty } = getRandomSizeAndDifficulty();
  return {
    size,
    difficulty,
    filename: null,
    isCompleted: isDailyCompleted()
  };
}

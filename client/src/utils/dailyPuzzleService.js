// Daily Puzzle Service
// Generates ONE random daily puzzle with randomized size and difficulty
// Saves to "daily-puzzles" folder following the same pattern as user-created puzzles

import { generatePuzzle } from './puzzleGenerator';
import { savePuzzleToServer, checkServerHealth } from './apiClient';
import { getDefaultParameters } from './wasmBridge';
import { parseInstanceFile } from './fileParser';
import { stringToGrid } from './sudokuUtils';

// Available sizes and difficulties
const SIZES = [6, 9, 12, 16, 25];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Fill percentages for each difficulty
const DIFFICULTY_FILL_PERCENT = {
  easy: 55,    // 55% filled - easier puzzle
  medium: 45,  // 45% filled - moderate difficulty
  hard: 35     // 35% filled - harder puzzle
};

// Philippines Standard Time (UTC+8) - all daily puzzle dates use this timezone
const PHILIPPINES_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Get the calendar date (YYYY-MM-DD) for a given moment in Philippines time.
 * @param {Date} date - Date object (typically new Date())
 * @returns {string} Date string like "2025-12-14"
 */
function getDateInPhilippines(date) {
  const ph = new Date(date.getTime() + PHILIPPINES_UTC_OFFSET_MS);
  const year = ph.getUTCFullYear();
  const month = String(ph.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ph.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date string in MMDDYYYY format for filename (Philippines time).
 * @returns {string} Date string like "12142025"
 */
function getTodayDateString() {
  const todayISO = getDateInPhilippines(new Date());
  const [y, m, d] = todayISO.split('-');
  return `${m}${d}${y}`;
}

/**
 * Get today's date in ISO format (Philippines Standard Time).
 * All daily puzzle "today" logic uses Philippines time, not the user's local time.
 * @returns {string} Date string like "2025-12-14"
 */
export function getTodayISOString() {
  return getDateInPhilippines(new Date());
}

/**
 * Get date string in ISO format for a specific date (UTC calendar date for API/storage).
 * @param {Date} date - Date object (e.g. from new Date("2026-02-19"))
 * @returns {string} Date string like "2025-12-14"
 */
function getDateISOString(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get date string in MMDDYYYY format for a specific date
 * @param {Date} date - Date object
 * @returns {string} Date string like "12142025"
 */
function getDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${day}${year}`;
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
 * Uses a more robust hash to ensure uniqueness
 * @param {string} str - Input string
 * @returns {number} Seed value
 */
function stringToSeed(str) {
  let hash = 0;
  // Use a better hash algorithm to ensure different dates produce different seeds
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
    // Add rotation to improve distribution
    hash = (hash << 13) | (hash >>> 19);
  }
  // Add a large prime multiplier to ensure uniqueness
  return Math.abs((hash * 2654435761) >>> 0);
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
 * Get random size and difficulty for a specific date (deterministic based on date)
 * @param {Date} date - Date object (defaults to today)
 * @returns {Object} { size, difficulty }
 */
function getRandomSizeAndDifficulty(date = null) {
  const targetDate = date || new Date();
  const dateString = getDateISOString(targetDate);
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
  const dateISO = getTodayISOString();
  const filename = generateDailyFilename(dateStr, size, difficulty);
  
  console.log(`Generating daily puzzle: ${size}x${size} ${difficulty} (${fillPercent}% filled)`);
  
  // Get default parameters for DCM-ACO
  const params = getDefaultParameters(size)[2]; // 2 = DCM-ACO
  
  // Use longer timeout for generation
  params.timeout = size <= 9 ? 15 : size <= 12 ? 45 : size <= 16 ? 90 : 180;
  
  // Create seeded random function for deterministic puzzle generation based on date
  // This ensures the same date always generates the same puzzle
  const seed = stringToSeed(dateISO);
  const seededRandomFn = seededRandom(seed);
  
  // Generate the puzzle using the same method as puzzleGenerator (with seeded random)
  const result = await generatePuzzle(size, 2, fillPercent, params, seededRandomFn);
  
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
      const saveResult = await saveDailyPuzzleToServer(puzzleData);
      
      // If puzzle already existed, use the existing puzzle data instead
      if (saveResult && saveResult.existingPuzzle) {
        console.log(`Using existing daily puzzle from server: ${saveResult.existingPuzzle.filename}`);
        // Cache the existing puzzle
        cacheDailyPuzzle(saveResult.existingPuzzle);
        return saveResult.existingPuzzle;
      }
      
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
        difficulty: puzzleData.difficulty,
        puzzleString: puzzleData.puzzleString,
        date: puzzleData.date
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const result = await response.json();
    
    // If puzzle already exists, use the existing puzzle data from server response
    if (result.alreadyExists && result.puzzleData) {
      console.log('Daily puzzle already exists on server, using existing puzzle');
      const existingPuzzle = {
        puzzleString: result.puzzleData.puzzleString,
        solutionString: result.puzzleData.filledString || null,
        instanceContent: result.puzzleData.content,
        size: result.puzzleData.size,
        difficulty: result.puzzleData.difficulty,
        fillPercent: DIFFICULTY_FILL_PERCENT[result.puzzleData.difficulty],
        filename: result.puzzleData.filename,
        date: result.puzzleData.date,
        dateCreated: result.puzzleData.date,
        source: 'daily',
        isDaily: true
      };
      // Return the existing puzzle data instead of the newly generated one
      return { ...result, existingPuzzle };
    }
    
    if (result.storage === 'vercel-kv') {
      console.log('Daily puzzle saved to Vercel KV database');
    } else if (result.storage === 'filesystem') {
      console.log('Daily puzzle saved to filesystem');
    } else {
      console.warn('Daily puzzle saved to localStorage only');
    }
    return result;
  } catch (error) {
    console.warn('Failed to save daily puzzle to server:', error);
    // Don't throw - saving to server is optional
  }
}

/**
 * Try to load daily puzzle from server/library for a specific date
 * @param {string} dateISO - Date in ISO format (YYYY-MM-DD)
 * @returns {Promise<Object|null>} Puzzle data or null if not found
 */
async function loadDailyPuzzleFromServer(dateISO) {
  try {
    // First try to get from KV via API
    try {
      const response = await fetch(`/api/puzzles/daily?date=${dateISO}`);
      if (response.ok) {
        const puzzleData = await response.json();
        return {
          puzzleString: puzzleData.puzzleString,
          size: puzzleData.size,
          difficulty: puzzleData.difficulty,
          filename: puzzleData.filename,
          date: puzzleData.date,
          dateCreated: puzzleData.date,
          source: 'daily',
          isDaily: true
        };
      }
    } catch (apiErr) {
      console.warn('KV API not available, trying static files:', apiErr);
    }
    
    // Fallback: Try to fetch from static files
    const date = new Date(dateISO);
    const { size, difficulty } = getRandomSizeAndDifficulty(date);
    const dateStr = getDateString(date);
    const filename = generateDailyFilename(dateStr, size, difficulty);
    
    const puzzlePath = `/instances/daily-puzzles/${filename}`;
    const response = await fetch(puzzlePath);
    
    if (response.ok) {
      const fileContent = await response.text();
      const { size: parsedSize, puzzleString } = parseInstanceFile(fileContent);
      
      return {
        puzzleString,
        size: parsedSize,
        difficulty,
        filename,
        date: dateISO,
        dateCreated: dateStr,
        source: 'daily',
        isDaily: true
      };
    }
  } catch (err) {
    console.warn(`Could not load daily puzzle from server for ${dateISO}:`, err);
  }
  
  return null;
}

/**
 * Generate daily puzzle for a specific date (deterministic)
 * @param {Date|string} date - Date object or ISO date string
 * @returns {Promise<Object>} Puzzle data
 */
export async function getDailyPuzzleForDate(date) {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const dateISO = getDateISOString(targetDate);
  
  // Check if it's today - use cached version if available
  if (dateISO === getTodayISOString()) {
    return await getDailyPuzzle();
  }
  
  // Try to load from server/library first
  const serverPuzzle = await loadDailyPuzzleFromServer(dateISO);
  if (serverPuzzle) {
    return serverPuzzle;
  }
  
  // Check localStorage cache for this date
  const cacheKey = `daily-puzzle-${dateISO}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const puzzleData = JSON.parse(cached);
      console.log(`Loaded daily puzzle from cache for ${dateISO}:`, puzzleData.filename);
      return puzzleData;
    }
  } catch (e) {
    console.warn(`Failed to read daily puzzle from cache for ${dateISO}:`, e);
  }
  
  // Generate on-demand (deterministic based on date)
  const { size, difficulty } = getRandomSizeAndDifficulty(targetDate);
  const fillPercent = DIFFICULTY_FILL_PERCENT[difficulty];
  const dateStr = getDateString(targetDate);
  const filename = generateDailyFilename(dateStr, size, difficulty);
  
  console.log(`Generating daily puzzle for ${dateISO}: ${size}x${size} ${difficulty} (${fillPercent}% filled)`);
  
  // Get default parameters for DCM-ACO
  const params = getDefaultParameters(size)[2]; // 2 = DCM-ACO
  
  // Use longer timeout for generation
  params.timeout = size <= 9 ? 15 : size <= 12 ? 45 : size <= 16 ? 90 : 180;
  
  // Create seeded random function for deterministic puzzle generation based on date
  // This ensures the same date always generates the same puzzle
  const seed = stringToSeed(dateISO);
  const seededRandomFn = seededRandom(seed);
  
  // Generate the puzzle (with seeded random for deterministic generation)
  const result = await generatePuzzle(size, 2, fillPercent, params, seededRandomFn);
  
  if (!result.success) {
    throw new Error(result.error || `Failed to generate daily puzzle for ${dateISO}`);
  }
  
  const puzzleData = {
    puzzleString: result.puzzleString,
    solutionString: result.filledString,
    instanceContent: result.instanceContent,
    size,
    difficulty,
    fillPercent,
    filename,
    date: dateISO,
    dateCreated: dateStr,
    source: 'daily',
    isDaily: true
  };
  
  // Cache it
  try {
    localStorage.setItem(cacheKey, JSON.stringify(puzzleData));
  } catch (e) {
    console.warn('Failed to cache daily puzzle:', e);
  }
  
  return puzzleData;
}

/**
 * Get today's daily puzzle
 * Creates one if it doesn't exist, otherwise returns cached version
 * @returns {Promise<Object>} Puzzle data
 */
export async function getDailyPuzzle() {
  // Check if we already have today's puzzle in cache
  const cached = getCachedDailyPuzzle();
  if (cached) {
    console.log('Loaded daily puzzle from cache:', cached.filename);
    return cached;
  }
  
  // IMPORTANT: Check if today's puzzle already exists on the server/KV FIRST
  // This prevents multiple users from generating different puzzles for the same date
  const todayISO = getTodayISOString();
  try {
    const serverOk = await checkServerHealth();
    if (serverOk) {
      const serverPuzzle = await loadDailyPuzzleFromServer(todayISO);
      if (serverPuzzle) {
        console.log('Loaded daily puzzle from server:', serverPuzzle.filename);
        // Cache it for future use
        cacheDailyPuzzle(serverPuzzle);
        return serverPuzzle;
      }
    }
  } catch (e) {
    console.warn('Could not check server for existing puzzle:', e);
  }
  
  // Only generate if no puzzle exists on server
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

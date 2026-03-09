// Game state persistence - save/load puzzle progress to localStorage

import { getTodayISOString } from './dailyPuzzleService';

const STORAGE_KEY = 'sudoku-game-state';

/**
 * Serialize notes (Set objects) to JSON-compatible format
 * @param {Array<Array<Set<number>>>} notes
 * @returns {Array<Array<number[]>>}
 */
function serializeNotes(notes) {
  if (!notes || !Array.isArray(notes)) return [];
  return notes.map(row =>
    Array.isArray(row)
      ? row.map(cell => (cell instanceof Set ? Array.from(cell) : []))
      : []
  );
}

/**
 * Deserialize notes from stored format back to Set objects
 * @param {Array<Array<number[]>>} serialized
 * @param {number} size
 * @returns {Array<Array<Set<number>>>}
 */
function deserializeNotes(serialized, size) {
  if (!serialized || !Array.isArray(serialized)) return createEmptyNotes(size);
  const notes = [];
  for (let r = 0; r < size; r++) {
    notes[r] = [];
    for (let c = 0; c < size; c++) {
      const arr = serialized[r]?.[c];
      notes[r][c] = Array.isArray(arr) ? new Set(arr) : new Set();
    }
  }
  return notes;
}

function createEmptyNotes(size) {
  const notes = [];
  for (let r = 0; r < size; r++) {
    notes[r] = [];
    for (let c = 0; c < size; c++) {
      notes[r][c] = new Set();
    }
  }
  return notes;
}

/**
 * Check if saved state is still valid (e.g. daily from same day, library/my puzzles loadable)
 * @param {Object} state
 * @returns {boolean}
 */
export function isStateValid(state) {
  if (!state || !state.puzzleKey || !state.grid || !state.originalGrid) return false;

  const key = state.puzzleKey;
  const todayISO = getTodayISOString();

  if (key.startsWith('daily-')) {
    const dateISO = key.replace('daily-', '');
    return dateISO === todayISO; // Only valid if same day
  }

  // library-*, my-*, created-* - assume loadable (we can't verify My puzzles id without reading storage)
  return true;
}

/**
 * Load game state from localStorage
 * @returns {Object|null} Parsed state or null
 */
export function loadGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.puzzleKey || !parsed.grid || !parsed.originalGrid) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save game state to localStorage
 * @param {Object} params
 * @param {string} params.puzzleKey
 * @param {Array<Array<string>>} params.grid
 * @param {Array<Array<string>>} params.originalGrid
 * @param {Array<Array<Set<number>>>} params.notes
 * @param {number} params.size
 * @param {string} params.difficulty
 * @param {boolean} params.isDaily
 * @param {number} params.timerSeconds
 */
export function saveGameState({ puzzleKey, grid, originalGrid, notes, size, difficulty, isDaily, timerSeconds }) {
  if (!puzzleKey) return;
  try {
    const payload = {
      puzzleKey,
      grid,
      originalGrid,
      notes: serializeNotes(notes),
      size,
      difficulty: difficulty || 'medium',
      isDaily: !!isDaily,
      timerSeconds: timerSeconds ?? 0,
      lastPlayedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save game state:', e);
  }
}

/**
 * Clear saved game state
 */
export function clearGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Restore game state into app state (returns object to pass to setState or similar)
 * @param {Object} state - From loadGameState()
 * @returns {Object|null} Object with grid, originalGrid, notes, size, difficulty, isDaily, timerSeconds or null
 */
export function restoreGameState(state) {
  if (!state || !state.puzzleKey || !state.grid || !state.originalGrid) return null;

  const size = state.size || 9;
  const notes = deserializeNotes(state.notes, size);

  return {
    puzzleKey: state.puzzleKey,
    grid: state.grid,
    originalGrid: state.originalGrid,
    notes,
    size,
    difficulty: state.difficulty || 'medium',
    isDaily: !!state.isDaily,
    timerSeconds: state.timerSeconds ?? 0
  };
}

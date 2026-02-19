// User-created puzzles stored in localStorage (no login)
// Only this browser sees the user's creations.

const STORAGE_KEY = 'user-created-puzzles';

/**
 * Get all user-created puzzles, newest first.
 * @returns {Array<{ id: string, createdAt: string, size: number, puzzleString: string, difficulty: string, algorithmUsed?: number, fillPercentage?: number }>}
 */
export function getUserCreatedPuzzles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch {
    return [];
  }
}

/**
 * Save a new user-created puzzle to localStorage.
 * @param {Object} puzzle - Must include size, puzzleString, difficulty; optional algorithmUsed, fillPercentage
 * @returns {Object} The saved puzzle with id and createdAt added
 */
export function saveUserCreatedPuzzle(puzzle) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `puzzle-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const createdAt = new Date().toISOString();
  const entry = {
    id,
    createdAt,
    size: puzzle.size,
    puzzleString: puzzle.puzzleString,
    difficulty: puzzle.difficulty,
    ...(puzzle.algorithmUsed != null && { algorithmUsed: puzzle.algorithmUsed }),
    ...(puzzle.fillPercentage != null && { fillPercentage: puzzle.fillPercentage }),
  };
  const list = getUserCreatedPuzzles();
  list.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return entry;
}

/**
 * Delete a user-created puzzle by id.
 * @param {string} id
 */
export function deleteUserCreatedPuzzle(id) {
  const list = getUserCreatedPuzzles().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

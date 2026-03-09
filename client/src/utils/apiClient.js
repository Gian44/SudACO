// API client for puzzle operations
const API_BASE_URL = '/api';

/**
 * Save a generated puzzle to the server
 * @param {string} category - Category name
 * @param {number} size - Grid size
 * @param {number} fillPercent - Fill percentage
 * @param {string} content - Puzzle file content
 * @param {string} puzzleString - Puzzle string for loading
 * @returns {Promise<Object>} API response
 */
export async function savePuzzleToServer(category, size, fillPercent, content, puzzleString) {
  try {
    const response = await fetch(`${API_BASE_URL}/save-puzzle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category,
        size,
        fillPercent,
        content,
        puzzleString
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving puzzle to server:', error);
    throw error;
  }
}

/**
 * Load puzzles from server
 * @returns {Promise<Object>} Puzzles index data
 */
export async function loadPuzzlesFromServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/puzzles`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error loading puzzles from server:', error);
    throw error;
  }
}

const SERVER_TIMEOUT_MS = 4000;

/**
 * Fetch with timeout to avoid hanging
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = SERVER_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

/**
 * Check if the API server is available
 * @returns {Promise<boolean>} True if server is available
 */
export async function checkServerHealth() {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Fallback to localStorage if server is not available
 */
export function getFallbackMessage() {
  return 'Server not available. Puzzles will be saved to browser storage only.';
}

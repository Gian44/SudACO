// API client for puzzle operations
const API_BASE_URL = '/api';
const MEMORY_CACHE = new Map();

function getLocalStorageCacheKey(key) {
  return `api-cache:${key}`;
}

function readCachedValue(key, ttlMs) {
  const now = Date.now();
  const inMemory = MEMORY_CACHE.get(key);
  if (inMemory && now - inMemory.timestamp < ttlMs) {
    return inMemory.value;
  }

  try {
    const raw = localStorage.getItem(getLocalStorageCacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (now - parsed.timestamp >= ttlMs) return null;
    MEMORY_CACHE.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCachedValue(key, value) {
  const entry = { timestamp: Date.now(), value };
  MEMORY_CACHE.set(key, entry);
  try {
    localStorage.setItem(getLocalStorageCacheKey(key), JSON.stringify(entry));
  } catch {
    // Ignore localStorage quota/availability errors.
  }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJsonWithCache(url, {
  timeoutMs = 3000,
  ttlMs = 60000,
  cacheKey = url,
  forceRefresh = false
} = {}) {
  if (!forceRefresh) {
    const cached = readCachedValue(cacheKey, ttlMs);
    if (cached) return cached;
  }

  const response = await fetchWithTimeout(url, {}, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  writeCachedValue(cacheKey, data);
  return data;
}

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
export async function loadPuzzlesFromServer(options = {}) {
  try {
    return await fetchJsonWithCache(`${API_BASE_URL}/puzzles`, {
      timeoutMs: options.timeoutMs ?? 3000,
      ttlMs: options.ttlMs ?? 120000,
      cacheKey: 'puzzles-index',
      forceRefresh: options.forceRefresh ?? false
    });
  } catch (error) {
    console.error('Error loading puzzles from server:', error);
    throw error;
  }
}

export async function loadPuzzleIndexWithFallback(options = {}) {
  try {
    return await loadPuzzlesFromServer(options);
  } catch (serverError) {
    const fallback = await fetchWithTimeout('/instances/index.json', {}, options.timeoutMs ?? 3000);
    if (!fallback.ok) {
      throw new Error(`Failed to fetch index: ${fallback.status}`);
    }
    return fallback.json();
  }
}

export async function loadDailyList(options = {}) {
  const timeoutMs = options.timeoutMs ?? 4500;
  const ttlMs = options.ttlMs ?? 120000;
  const forceRefresh = options.forceRefresh ?? false;

  try {
    const data = await fetchJsonWithCache(`${API_BASE_URL}/puzzles/daily-list`, {
      timeoutMs,
      ttlMs,
      cacheKey: 'daily-list',
      forceRefresh
    });
    console.info(`[daily-list] primary fetch success: ${Array.isArray(data) ? data.length : 0} items`);
    return data;
  } catch (error) {
    console.warn('[daily-list] primary fetch failed, retrying once:', error?.message || error);
    try {
      const retryData = await fetchJsonWithCache(`${API_BASE_URL}/puzzles/daily-list`, {
        timeoutMs: 9000,
        ttlMs,
        cacheKey: 'daily-list',
        forceRefresh: true
      });
      console.info(`[daily-list] retry fetch success: ${Array.isArray(retryData) ? retryData.length : 0} items`);
      return retryData;
    } catch (retryError) {
      console.warn('[daily-list] retry fetch failed, returning empty list:', retryError?.message || retryError);
    }
    return [];
  }
}

export function prefetchCorePuzzleData() {
  void Promise.allSettled([
    loadPuzzlesFromServer({ timeoutMs: 3000, ttlMs: 120000 }),
    loadDailyList({ timeoutMs: 4500, ttlMs: 120000 })
  ]);
}

/**
 * Check if the API server is available
 * @returns {Promise<boolean>} True if server is available
 */
export async function checkServerHealth() {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {}, 1500);
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

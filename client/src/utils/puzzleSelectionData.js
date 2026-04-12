import { getDailyPuzzleInfo, getTodayISOString } from './dailyPuzzleService';
import { loadDailyList, loadPuzzleIndexWithFallback } from './apiClient';

const MODAL_DATA_TTL_MS = 2 * 60 * 1000;

const modalDataCache = {
  data: null,
  loadingPromise: null,
  loadedAt: 0
};

function parseDailyFilename(filename) {
  if (typeof filename !== 'string') return null;
  // Expected format: MMDDYYYY_<size>x<size>_<difficulty>.txt
  const match = filename.match(/^(\d{2})(\d{2})(\d{4})_(\d+x\d+)_([a-z]+)\.txt$/i);
  if (!match) return null;
  const [, month, day, year, sizeLabel, difficulty] = match;
  const date = `${year}-${month}-${day}`;
  return {
    date,
    dateDisplay: new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    filename,
    size: sizeLabel,
    difficulty: difficulty.toLowerCase(),
    source: 'server-index'
  };
}

function deriveDailyPuzzlesFromCategories(categories) {
  const dailyFiles = categories?.['daily-puzzles'];
  if (!Array.isArray(dailyFiles) || dailyFiles.length === 0) {
    return [];
  }

  const parsed = dailyFiles
    .map((filename) => parseDailyFilename(filename))
    .filter(Boolean);

  // Keep latest entry per day if duplicates exist.
  const perDate = new Map();
  parsed.forEach((entry) => {
    perDate.set(entry.date, entry);
  });

  return Array.from(perDate.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function buildPreviousDailyPuzzles(serverPuzzles) {
  const allPuzzles = [];
  let localCount = 0;

  (Array.isArray(serverPuzzles) ? serverPuzzles : []).forEach((puzzle) => {
    allPuzzles.push({
      ...puzzle,
      source: 'server',
      dateDisplay: new Date(puzzle.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    });
  });

  const todayPhilippines = getTodayISOString();
  const [ty, tm, td] = todayPhilippines.split('-').map(Number);
  for (let i = 0; i <= 30; i += 1) {
    const past = new Date(ty, tm - 1, td - i);
    const dateISO = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    const cacheKey = `daily-puzzle-${dateISO}`;

    if (allPuzzles.some((p) => p.date === dateISO)) {
      continue;
    }

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const puzzleData = JSON.parse(cached);
        localCount += 1;
        allPuzzles.push({
          date: dateISO,
          dateDisplay: past.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          size: puzzleData.size,
          difficulty: puzzleData.difficulty,
          filename: puzzleData.filename,
          source: 'local'
        });
      }
    } catch {
      // Ignore invalid local cache entries.
    }
  }

  allPuzzles.sort((a, b) => new Date(b.date) - new Date(a.date));
  const todayISO = getTodayISOString();
  const filtered = allPuzzles.filter((p) => p.date <= todayISO);
  console.info(
    `[puzzle-selection] daily merge: server=${Array.isArray(serverPuzzles) ? serverPuzzles.length : 0}, local=${localCount}, final=${filtered.length}`
  );
  return filtered;
}

async function loadSelectionModalData() {
  console.info('[puzzle-selection] loading modal data...');
  const dailyInfo = getDailyPuzzleInfo();
  const [dailyListResult, categoriesResult] = await Promise.allSettled([
    loadDailyList({ timeoutMs: 4500, ttlMs: 120000 }),
    loadPuzzleIndexWithFallback({ timeoutMs: 3000, ttlMs: 120000 })
  ]);

  if (dailyListResult.status === 'fulfilled') {
    console.info(`[puzzle-selection] daily-list resolved: ${Array.isArray(dailyListResult.value) ? dailyListResult.value.length : 0} items`);
  } else {
    console.warn('[puzzle-selection] daily-list failed:', dailyListResult.reason?.message || dailyListResult.reason);
  }

  if (categoriesResult.status === 'fulfilled') {
    console.info(`[puzzle-selection] categories resolved: ${Object.keys(categoriesResult.value || {}).length} groups`);
  } else {
    console.warn('[puzzle-selection] categories failed:', categoriesResult.reason?.message || categoriesResult.reason);
  }

  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : {};
  const dailyFromList = dailyListResult.status === 'fulfilled' ? dailyListResult.value : [];
  const derivedFromIndex = deriveDailyPuzzlesFromCategories(categories);
  const effectiveServerDaily = Array.isArray(dailyFromList) && dailyFromList.length > 0
    ? dailyFromList
    : derivedFromIndex;

  if ((!Array.isArray(dailyFromList) || dailyFromList.length === 0) && derivedFromIndex.length > 0) {
    console.info(`[puzzle-selection] using categories-derived daily list fallback: ${derivedFromIndex.length} items`);
  }

  const previousDailyPuzzles = buildPreviousDailyPuzzles(effectiveServerDaily);

  if (categoriesResult.status === 'rejected') {
    return {
      dailyInfo,
      previousDailyPuzzles,
      categories: {},
      loadError: `Failed to load puzzle library: ${categoriesResult.reason?.message || 'Unknown error'}`
    };
  }

  return {
    dailyInfo,
    previousDailyPuzzles,
    categories,
    loadError: ''
  };
}

export function getCachedSelectionModalSnapshot() {
  if (!modalDataCache.data) return null;
  if (Date.now() - modalDataCache.loadedAt >= MODAL_DATA_TTL_MS) return null;
  return modalDataCache.data;
}

export async function getCachedSelectionModalData({ forceRefresh = false } = {}) {
  const snapshot = getCachedSelectionModalSnapshot();
  if (!forceRefresh && snapshot) {
    console.info('[puzzle-selection] using cached modal snapshot');
    return snapshot;
  }

  if (!modalDataCache.loadingPromise) {
    modalDataCache.loadingPromise = loadSelectionModalData()
      .then((data) => {
        modalDataCache.data = data;
        modalDataCache.loadedAt = Date.now();
        return data;
      })
      .finally(() => {
        modalDataCache.loadingPromise = null;
      });
  }

  return modalDataCache.loadingPromise;
}

export function prefetchSelectionModalData() {
  console.info('[puzzle-selection] prefetch requested');
  void getCachedSelectionModalData();
}

import { getDailyPuzzleInfo, getTodayISOString } from './dailyPuzzleService';
import { loadDailyList, loadPuzzleIndexWithFallback } from './apiClient';

const MODAL_DATA_TTL_MS = 2 * 60 * 1000;

const modalDataCache = {
  data: null,
  loadingPromise: null,
  loadedAt: 0
};

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
  const [serverPuzzles, categoriesResult] = await Promise.allSettled([
    loadDailyList({ timeoutMs: 4500, ttlMs: 120000 }),
    loadPuzzleIndexWithFallback({ timeoutMs: 3000, ttlMs: 120000 })
  ]);

  if (serverPuzzles.status === 'fulfilled') {
    console.info(`[puzzle-selection] daily-list resolved: ${Array.isArray(serverPuzzles.value) ? serverPuzzles.value.length : 0} items`);
  } else {
    console.warn('[puzzle-selection] daily-list failed:', serverPuzzles.reason?.message || serverPuzzles.reason);
  }

  if (categoriesResult.status === 'fulfilled') {
    console.info(`[puzzle-selection] categories resolved: ${Object.keys(categoriesResult.value || {}).length} groups`);
  } else {
    console.warn('[puzzle-selection] categories failed:', categoriesResult.reason?.message || categoriesResult.reason);
  }

  const previousDailyPuzzles = buildPreviousDailyPuzzles(
    serverPuzzles.status === 'fulfilled' ? serverPuzzles.value : []
  );

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
    categories: categoriesResult.value,
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

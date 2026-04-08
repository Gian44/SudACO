import { solveSudoku, solveSudokuWithProgress } from '../utils/wasmBridge';

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
  if (type !== 'solve') {
    return;
  }

  try {
    const { puzzleString, algorithm, params, withProgress } = payload;
    const result = withProgress
      ? await solveSudokuWithProgress(puzzleString, algorithm, params)
      : await solveSudoku(puzzleString, algorithm, params);
    self.postMessage({ type: 'result', payload: result });
  } catch (error) {
    self.postMessage({
      type: 'result',
      payload: { success: false, error: error.message || 'Solver worker failed' }
    });
  }
};

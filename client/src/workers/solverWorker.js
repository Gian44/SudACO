import { solveSudoku } from '../utils/wasmBridge';

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
  if (type !== 'solve') {
    return;
  }

  try {
    const { puzzleString, algorithm, params } = payload;
    const result = await solveSudoku(puzzleString, algorithm, params);
    self.postMessage({ type: 'result', payload: result });
  } catch (error) {
    self.postMessage({
      type: 'result',
      payload: { success: false, error: error.message || 'Solver worker failed' }
    });
  }
};

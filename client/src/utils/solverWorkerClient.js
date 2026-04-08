export function createSolverWorkerRunner() {
  let worker = null;

  const start = (puzzleString, algorithm, params) => {
    if (worker) {
      worker.terminate();
    }

    worker = new Worker(new URL('../workers/solverWorker.js', import.meta.url), {
      type: 'module'
    });

    return new Promise((resolve) => {
      worker.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'result') {
          worker.terminate();
          worker = null;
          resolve(payload);
        }
      };
      worker.onerror = (event) => {
        if (worker) {
          worker.terminate();
          worker = null;
        }
        resolve({ success: false, error: event.message || 'Solver worker crashed' });
      };
      worker.postMessage({ type: 'solve', payload: { puzzleString, algorithm, params } });
    });
  };

  const stop = () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  };

  const dispose = () => stop();

  return { start, stop, dispose };
}

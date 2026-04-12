import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainMenuPage from './pages/MainMenuPage';
import PlayModePage from './pages/PlayModePage';
import CreateUploadPage from './pages/CreateUploadPage';
import AboutPage from './pages/AboutPage';
import { prefetchCorePuzzleData } from './utils/apiClient';
import { prefetchSelectionModalData } from './utils/puzzleSelectionData';

function App() {
  useEffect(() => {
    const runPrefetch = () => {
      prefetchCorePuzzleData();
      prefetchSelectionModalData();
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(runPrefetch, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }

    const timeoutId = setTimeout(runPrefetch, 150);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<MainMenuPage />} />
      <Route path="/game" element={<PlayModePage mode="game" />} />
      <Route path="/experiment" element={<PlayModePage mode="experiment" />} />
      <Route path="/create" element={<CreateUploadPage tab="create" />} />
      <Route path="/upload" element={<CreateUploadPage tab="upload" />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

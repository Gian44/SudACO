import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainMenuPage from './pages/MainMenuPage';
import PlayModePage from './pages/PlayModePage';
import CreateUploadPage from './pages/CreateUploadPage';
import AboutPage from './pages/AboutPage';

function App() {
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

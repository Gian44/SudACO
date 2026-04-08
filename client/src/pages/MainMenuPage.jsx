import React from 'react';
import { Link } from 'react-router-dom';
import sudacoLogo from '../assets/sudaco-logo.svg';

const menuItems = [
  { path: '/game', title: 'Game Mode', description: 'Play with a clean game screen, quick solve, and PDF export.' },
  { path: '/experiment', title: 'Experiment Mode', description: 'Play with side controls for parameters and puzzle library.' },
  { path: '/create', title: 'Create Puzzle', description: 'Generate a puzzle in-browser and start playing.' },
  { path: '/upload', title: 'Upload Puzzle', description: 'Upload your own puzzle file and play it.' },
  { path: '/about', title: 'About Game', description: 'Read the user manual and Game Mode instructions.' }
];

function MainMenuPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={sudacoLogo} alt="SudACO Logo" className="w-12 h-12 rounded-xl shadow-lg" />
          <div>
            <h1 className="text-3xl font-bold text-gradient">SudACO</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Main Menu</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path} className="card block hover:-translate-y-1 transition-transform">
              <h2 className="text-xl font-semibold mb-2">{item.title}</h2>
              <p className="text-[var(--color-text-secondary)] text-sm">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MainMenuPage;

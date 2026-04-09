import React from 'react';
import { Link } from 'react-router-dom';
import sudacoLogo from '../assets/sudaco-logo.svg';

const menuItems = [
  {
    path: '/game',
    title: 'Game Mode',
    description: 'Enter the Sudoku arena, race the solver, and claim your victory PDF.',
    tier: 'primary',
    icon: 'play'
  },
  {
    path: '/experiment',
    title: 'Experiment Mode',
    description: 'Play with side controls for parameters and puzzle library.',
    tier: 'secondary',
    icon: 'flask'
  },
  {
    path: '/create',
    title: 'Create Puzzle',
    description: 'Generate a puzzle in-browser and start playing.',
    tier: 'tertiary',
    icon: 'wand'
  },
  {
    path: '/upload',
    title: 'Upload Puzzle',
    description: 'Upload your own puzzle file and play it.',
    tier: 'tertiary',
    icon: 'upload'
  },
  {
    path: '/about',
    title: 'About Game',
    description: 'Read the user manual and Game Mode instructions.',
    tier: 'tertiary',
    icon: 'info'
  }
];

function MenuIcon({ name }) {
  const icons = {
    play: (
      <path
        d="M8 6.75c0-1.17 1.27-1.89 2.27-1.29l7.2 4.25a1.5 1.5 0 0 1 0 2.58l-7.2 4.25C9.27 17.14 8 16.42 8 15.25V6.75Z"
        fill="currentColor"
      />
    ),
    flask: (
      <path
        d="M10 3.75A.75.75 0 0 1 10.75 3h2.5a.75.75 0 0 1 0 1.5h-.25v2.8l4.47 7.45A3 3 0 0 1 14.9 19H9.1a3 3 0 0 1-2.57-4.25L11 7.3V4.5h-.25A.75.75 0 0 1 10 3.75Zm2 5.6-4.18 6.98a1.5 1.5 0 0 0 1.28 2.25h5.8a1.5 1.5 0 0 0 1.28-2.25L12 9.35Z"
        fill="currentColor"
      />
    ),
    wand: (
      <>
        <path
          d="M15.53 4.47a.75.75 0 0 1 1.06 0l2.94 2.94a.75.75 0 0 1 0 1.06L9.84 18.16a2.25 2.25 0 0 1-3.18 0l-.82-.82a2.25 2.25 0 0 1 0-3.18L15.53 4.47Zm.53 1.59L6.9 15.22a.75.75 0 0 0 0 1.06l.82.82a.75.75 0 0 0 1.06 0l9.16-9.16-1.88-1.88Z"
          fill="currentColor"
        />
        <path d="M6.5 4.25a.75.75 0 0 1 1.5 0v1.25h1.25a.75.75 0 0 1 0 1.5H8v1.25a.75.75 0 0 1-1.5 0V7H5.25a.75.75 0 0 1 0-1.5H6.5V4.25Z" fill="currentColor" />
      </>
    ),
    upload: (
      <path
        d="M12 3.75a.75.75 0 0 1 .75.75v8.44l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V4.5a.75.75 0 0 1 .75-.75ZM5 17.25A1.75 1.75 0 0 0 6.75 19h10.5A1.75 1.75 0 0 0 19 17.25v-1a.75.75 0 0 1 1.5 0v1a3.25 3.25 0 0 1-3.25 3.25H6.75A3.25 3.25 0 0 1 3.5 17.25v-1a.75.75 0 1 1 1.5 0v1Z"
        fill="currentColor"
      />
    ),
    info: (
      <path
        d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 1.5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2.25a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-.75 4a.75.75 0 0 1 1.5 0v5a.75.75 0 0 1-1.5 0v-5Z"
        fill="currentColor"
      />
    )
  };

  return (
    <span className="menu-icon-wrapper" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="menu-icon" focusable="false">
        {icons[name]}
      </svg>
    </span>
  );
}

function MainMenuPage() {
  const primaryItem = menuItems.find((item) => item.tier === 'primary');
  const secondaryItem = menuItems.find((item) => item.tier === 'secondary');
  const tertiaryItems = menuItems.filter((item) => item.tier === 'tertiary');
  const getMenuItemVariantClass = (item) => `menu-item-${item.icon}`;

  return (
    <div className="menu-shell">
      <div className="menu-shell-gradient" aria-hidden="true" />
      <div className="menu-shell-grid" aria-hidden="true" />
      <div className="menu-container">
        <header className="menu-header card">
          <div className="menu-header-left">
            <img src={sudacoLogo} alt="SudACO Logo" className="menu-logo" />
            <div>
              <h1 className="menu-title">SudACO</h1>
              <p className="menu-subtitle">Sudoku Game</p>
            </div>
          </div>
        </header>

        <main className="menu-main card">
          <section className="menu-section">
            <p className="menu-section-label">Play</p>
            {primaryItem && (
              <Link
                key={primaryItem.path}
                to={primaryItem.path}
                className={`menu-item menu-item-primary ${getMenuItemVariantClass(primaryItem)}`}
              >
                <div className="menu-item-top">
                  <MenuIcon name={primaryItem.icon} />
                  <span className="menu-item-chip">Recommended</span>
                </div>
                <h2 className="menu-item-title">{primaryItem.title}</h2>
                <p className="menu-item-description">{primaryItem.description}</p>
              </Link>
            )}
            {secondaryItem && (
              <Link
                key={secondaryItem.path}
                to={secondaryItem.path}
                className={`menu-item menu-item-secondary ${getMenuItemVariantClass(secondaryItem)}`}
              >
                <div className="menu-item-top">
                  <MenuIcon name={secondaryItem.icon} />
                </div>
                <h2 className="menu-item-title">{secondaryItem.title}</h2>
                <p className="menu-item-description">{secondaryItem.description}</p>
              </Link>
            )}
          </section>

          <section className="menu-section">
            <p className="menu-section-label">Tools & Info</p>
            <div className="menu-grid">
              {tertiaryItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`menu-item menu-item-tertiary ${getMenuItemVariantClass(item)}`}
                >
                  <div className="menu-item-top">
                    <MenuIcon name={item.icon} />
                  </div>
                  <h2 className="menu-item-title">{item.title}</h2>
                  <p className="menu-item-description">{item.description}</p>
                </Link>
              ))}
            </div>
          </section>

          <div className="menu-footer">
            <span>Pick a mode to begin</span>
            <span className="menu-footer-dot" aria-hidden="true" />
            <span>Progress auto-saves during play</span>
          </div>
        </main>
      </div>
    </div>
  );
}

export default MainMenuPage;

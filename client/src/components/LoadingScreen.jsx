import React from 'react';
import sudacoLogo from '../assets/sudaco-logo.svg';

const LoadingScreen = ({ message = 'Loading...', subMessage = '' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          {/* Outer rotating ring */}
          <div 
            className="absolute inset-0 rounded-2xl border-4 border-transparent"
            style={{
              borderTopColor: 'var(--color-primary)',
              borderRightColor: 'var(--color-secondary)',
              animation: 'spin 1.5s linear infinite'
            }}
          />
          {/* Inner logo */}
          <div className="absolute inset-2 rounded-xl overflow-hidden shadow-lg">
            <img 
              src={sudacoLogo} 
              alt="SudACO Logo" 
              className="w-full h-full"
            />
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-3xl font-bold text-gradient mb-2">SudACO</h1>
        <p className="text-[var(--color-text-muted)] text-sm mb-6">Sudoku Game</p>
        
        {/* Loading message */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="spinner" />
            <span className="text-[var(--color-text-secondary)]">{message}</span>
          </div>
          {subMessage && (
            <p className="text-sm text-[var(--color-text-muted)]">{subMessage}</p>
          )}
        </div>
        
        {/* Animated dots */}
        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--color-primary)]"
              style={{
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;


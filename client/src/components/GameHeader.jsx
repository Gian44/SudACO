import React, { useState, useEffect, useCallback } from 'react';
import DifficultyBadge from './DifficultyBadge';
import sudacoLogo from '../assets/sudaco-logo.svg';

const GameHeader = ({ 
  isPlaying, 
  isPaused,
  difficulty,
  puzzleSize,
  onNewPuzzle,
  onPause,
  onResume,
  timerRef,
  isDaily = false,
  algorithmSolveTime = null
}) => {
  const [seconds, setSeconds] = useState(0);
  
  // Timer logic
  useEffect(() => {
    let interval = null;
    
    if (isPlaying && !isPaused) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isPaused]);
  
  // Reset timer when puzzle changes
  useEffect(() => {
    if (!isPlaying) {
      setSeconds(0);
    }
  }, [isPlaying]);
  
  // Expose timer value via ref
  useEffect(() => {
    if (timerRef) {
      timerRef.current = seconds;
    }
  }, [seconds, timerRef]);
  
  // Format time as MM:SS
  const formatTime = useCallback((totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Format algorithm solve time
  const formatAlgorithmTime = useCallback((milliseconds) => {
    if (milliseconds < 1000) {
      return `${milliseconds.toFixed(0)}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(2)}s`;
    } else {
      const mins = Math.floor(milliseconds / 60000);
      const secs = ((milliseconds % 60000) / 1000).toFixed(0);
      return `${mins}:${secs.padStart(2, '0')}`;
    }
  }, []);
  
  return (
    <header className="w-full max-w-2xl mx-auto mb-6">
      {/* Main header row */}
      <div className="flex items-center justify-between mb-4">
        {/* Logo/Title */}
        <div className="flex items-center gap-3">
          <img 
            src={sudacoLogo} 
            alt="SudACO Logo" 
            className="w-10 h-10 rounded-xl shadow-lg"
          />
          <div>
            <h1 className="text-xl font-bold text-gradient">SudACO</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Sudoku Game</p>
          </div>
        </div>
        
        {/* Timer */}
        <div className="flex items-center gap-3">
          <div className="timer flex items-center gap-2">
            {isPaused ? (
              <svg className="w-5 h-5 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : isPlaying ? (
              <svg className="w-5 h-5 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            )}
            <span>
              {algorithmSolveTime !== null 
                ? formatAlgorithmTime(algorithmSolveTime)
                : formatTime(seconds)
              }
            </span>
          </div>
          
          {/* Pause/Resume button */}
          {isPlaying && (
            <button
              onClick={isPaused ? onResume : onPause}
              className="p-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
        </div>
        
        {/* New Puzzle Button */}
        <button
          onClick={onNewPuzzle}
          className="btn btn-primary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Puzzle
        </button>
      </div>
      
      {/* Puzzle info row */}
      <div className="flex items-center justify-center gap-4">
        {isDaily && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
            <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-purple-300">Daily Challenge</span>
          </div>
        )}
        
        <div className="text-sm text-[var(--color-text-secondary)]">
          {puzzleSize}×{puzzleSize}
        </div>
        
        {difficulty && <DifficultyBadge difficulty={difficulty} />}
      </div>
    </header>
  );
};

export default GameHeader;

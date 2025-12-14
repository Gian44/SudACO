import React, { useEffect, useState } from 'react';
import { markDailyCompleted } from '../utils/dailyPuzzleService';

const CompletionModal = ({ 
  isOpen, 
  onClose, 
  onPlayAgain,
  timeSeconds,
  puzzleSize,
  difficulty,
  isDaily,
  wasAlgorithmSolved = false
}) => {
  const [confetti, setConfetti] = useState([]);

  // Format time as MM:SS
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate confetti on open
  useEffect(() => {
    if (isOpen && !wasAlgorithmSolved) {
      const colors = ['#8B5CF6', '#06B6D4', '#EC4899', '#10B981', '#F59E0B'];
      const newConfetti = [];
      
      for (let i = 0; i < 50; i++) {
        newConfetti.push({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 2,
          duration: 2 + Math.random() * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 6 + Math.random() * 8
        });
      }
      
      setConfetti(newConfetti);
      
      // Mark daily as completed
      if (isDaily) {
        markDailyCompleted(puzzleSize, timeSeconds);
      }
    }
  }, [isOpen, wasAlgorithmSolved, isDaily, puzzleSize, timeSeconds]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      {/* Confetti */}
      {!wasAlgorithmSolved && confetti.map(c => (
        <div
          key={c.id}
          className="fixed pointer-events-none"
          style={{
            left: `${c.left}%`,
            top: '-20px',
            width: `${c.size}px`,
            height: `${c.size}px`,
            backgroundColor: c.color,
            borderRadius: c.size > 10 ? '50%' : '2px',
            animation: `confetti ${c.duration}s ease-out ${c.delay}s forwards`,
            transform: `rotate(${Math.random() * 360}deg)`
          }}
        />
      ))}
      
      <div className="modal-content w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
        {/* Icon */}
        <div className="mb-6">
          {wasAlgorithmSolved ? (
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--color-secondary)]/20 flex items-center justify-center">
              <span className="text-4xl">🤖</span>
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center animate-pulse">
              <span className="text-4xl">🎉</span>
            </div>
          )}
        </div>
        
        {/* Title */}
        <h2 className="text-3xl font-bold mb-2">
          {wasAlgorithmSolved ? (
            <span className="text-[var(--color-secondary)]">Puzzle Solved!</span>
          ) : (
            <span className="text-gradient">Congratulations!</span>
          )}
        </h2>
        
        <p className="text-[var(--color-text-secondary)] mb-6">
          {wasAlgorithmSolved 
            ? 'The algorithm found the solution.'
            : 'You solved the puzzle!'}
        </p>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {formatTime(timeSeconds)}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Time</div>
          </div>
          <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <div className="text-2xl font-bold text-[var(--color-secondary)]">
              {puzzleSize}×{puzzleSize}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Size</div>
          </div>
        </div>
        
        {/* Daily badge */}
        {isDaily && !wasAlgorithmSolved && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
            <div className="flex items-center justify-center gap-2 text-purple-300">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Daily Challenge Complete!</span>
            </div>
          </div>
        )}
        
        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onPlayAgain}
            className="btn btn-primary flex-1 py-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Play Again
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1 py-3"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletionModal;

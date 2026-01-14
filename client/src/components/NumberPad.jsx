import React from 'react';
import { getCompletedNumbers } from '../utils/sudokuUtils';

const NumberPad = ({ 
  size, 
  onNumberClick, 
  onDelete,
  onGiveUp,
  notesMode, 
  onToggleNotes,
  grid,
  disabled = false 
}) => {
  // Get completed numbers (all 9 instances placed)
  const completedNumbers = grid ? getCompletedNumbers(grid, size) : [];
  
  // Generate number buttons based on size
  const numbers = Array.from({ length: size }, (_, i) => i + 1);
  
  // For larger grids, organize in rows
  const getGridCols = () => {
    if (size <= 9) return 'grid-cols-5';
    if (size <= 12) return 'grid-cols-6';
    if (size <= 16) return 'grid-cols-6';
    return 'grid-cols-7';
  };
  
  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 mt-4 sm:mt-6 w-full max-w-full px-2 sm:px-0">
      {/* Number pad */}
      <div className={`grid ${getGridCols()} gap-4 sm:gap-2 w-full max-w-md`}>
        {numbers.map(num => {
          const isCompleted = completedNumbers.includes(num);
          return (
            <button
              key={num}
              onClick={() => onNumberClick(num)}
              disabled={disabled || isCompleted}
              className={`
                number-btn
                ${notesMode ? 'notes-mode' : ''}
                ${isCompleted ? 'opacity-30 cursor-not-allowed' : ''}
                ${size > 9 ? 'w-7 h-7 sm:w-10 sm:h-10 text-xs sm:text-sm' : 'w-9 h-9 sm:w-12 sm:h-12 text-xs sm:text-base'}
              `}
              title={isCompleted ? `All ${num}s placed` : `Place ${num}${notesMode ? ' (note)' : ''}`}
            >
              {num}
            </button>
          );
        })}
        
        {/* Delete button */}
        <button
          onClick={onDelete}
          disabled={disabled}
          className={`number-btn bg-[var(--color-error)]/20 border-[var(--color-error)]/50 hover:bg-[var(--color-error)] hover:border-[var(--color-error)] flex items-center justify-center ${size > 9 ? 'w-7 h-7 sm:w-10 sm:h-10' : 'w-9 h-9 sm:w-12 sm:h-12'}`}
          title="Delete"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
        </button>
      </div>
      
      {/* Control buttons */}
      <div className="flex items-center gap-2 sm:gap-3 w-full max-w-md justify-center flex-wrap">
        {/* Notes toggle */}
        <button
          onClick={onToggleNotes}
          disabled={disabled}
          className={`
            btn ${notesMode ? 'btn-secondary' : 'btn-secondary'}
            ${notesMode ? 'ring-2 ring-[var(--color-secondary)] bg-[var(--color-secondary)]/20' : ''}
            text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2
          `}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="hidden sm:inline">Notes {notesMode ? 'ON' : 'OFF'}</span>
          <span className="sm:hidden">{notesMode ? 'ON' : 'OFF'}</span>
        </button>
        
        {/* Give Up button */}
        <button
          onClick={onGiveUp}
          disabled={disabled}
          className="btn btn-danger text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="hidden sm:inline">Give Up</span>
          <span className="sm:hidden">Give Up</span>
        </button>
      </div>
    </div>
  );
};

export default NumberPad;

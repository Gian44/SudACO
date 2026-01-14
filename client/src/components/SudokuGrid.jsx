import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getValidCharacters, getBoxDimensions, findConflicts } from '../utils/sudokuUtils';

const SudokuGrid = ({ 
  grid, 
  onChange, 
  size, 
  readOnly = false,
  originalGrid = null,
  notes = null,
  onNotesChange = null,
  notesMode = false,
  selectedCell = null,
  onCellSelect = null,
  animatingCells = new Set(),
  isPaused = false
}) => {
  const validChars = getValidCharacters(size);
  const { boxRows, boxCols } = getBoxDimensions(size);
  const gridRef = useRef(null);
  
  // Track window size for responsive design
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Find all conflicts in the current grid
  const conflicts = findConflicts(grid, size);
  
  // Track recently changed cells for animation
  const [recentlyChanged, setRecentlyChanged] = useState(new Set());
  
  // Handle cell change
  const handleCellChange = useCallback((row, col, value) => {
    if (readOnly || isPaused) return;
    
    // Check if this is an original cell
    if (originalGrid && originalGrid[row] && originalGrid[row][col] !== '') {
      return; // Can't modify original cells
    }

    // Validate input
    if (value !== '' && !validChars.includes(value)) {
      return; // Invalid character, ignore
    }

    // Add to recently changed for animation
    setRecentlyChanged(prev => new Set([...prev, `${row}-${col}`]));
    setTimeout(() => {
      setRecentlyChanged(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${row}-${col}`);
        return newSet;
      });
    }, 300);

    onChange(row, col, value);
  }, [readOnly, isPaused, originalGrid, validChars, onChange]);

  // Handle notes toggle
  const handleNoteToggle = useCallback((row, col, value) => {
    if (readOnly || isPaused || !onNotesChange || !notes) return;
    
    // Check if this is an original cell or has a value
    if (originalGrid && originalGrid[row] && originalGrid[row][col] !== '') {
      return;
    }
    if (grid[row][col] !== '') {
      return; // Can't add notes to filled cells
    }
    
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1 || numValue > size) return;
    
    const newNotes = notes.map(r => r.map(c => new Set(c)));
    if (newNotes[row][col].has(numValue)) {
      newNotes[row][col].delete(numValue);
    } else {
      newNotes[row][col].add(numValue);
    }
    onNotesChange(newNotes);
  }, [readOnly, isPaused, onNotesChange, notes, originalGrid, grid, size]);

  // Handle keyboard input
  const handleKeyDown = useCallback((e, row, col) => {
    if (readOnly || isPaused) return;

    const { key } = e;
    
    // Handle number input
    if (/^[1-9]$/.test(key) || (size > 9 && /^[0-9]$/.test(key))) {
      e.preventDefault();
      if (notesMode) {
        handleNoteToggle(row, col, key);
      } else {
        if (parseInt(key) <= size) {
          handleCellChange(row, col, key);
        }
      }
      return;
    }
    
    // Handle special keys
    if (key === 'Backspace' || key === 'Delete') {
      handleCellChange(row, col, '');
      e.preventDefault();
      return;
    }

    // Handle arrow keys for navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
      let newRow = row;
      let newCol = col;

      switch (key) {
        case 'ArrowUp':
          newRow = Math.max(0, row - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(size - 1, row + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, col - 1);
          break;
        case 'ArrowRight':
          newCol = Math.min(size - 1, col + 1);
          break;
      }

      if (onCellSelect) {
        onCellSelect([newRow, newCol]); // Pass as array
      }
      
      // Focus the new cell
      setTimeout(() => {
        const newCell = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
        if (newCell) newCell.focus();
      }, 0);
    }
  }, [readOnly, isPaused, size, notesMode, handleNoteToggle, handleCellChange, onCellSelect]);

  // Handle input change
  const handleInputChange = useCallback((e, row, col) => {
    if (readOnly || isPaused) return;
    
    let value = e.target.value.trim();
    
    // For sizes > 9, allow multi-digit numbers
    if (size > 9) {
      value = value.replace(/\D/g, '');
      if (value !== '') {
        const num = parseInt(value);
        if (num > size) {
          value = String(size);
        } else if (num < 1) {
          value = '1';
        } else {
          value = String(num);
        }
      }
    } else {
      value = value.slice(-1);
      if (value && !/^[1-9]$/.test(value)) {
        return;
      }
    }
    
    if (notesMode && value !== '') {
      handleNoteToggle(row, col, value);
      e.target.value = grid[row][col];
    } else {
      handleCellChange(row, col, value);
    }
  }, [readOnly, isPaused, size, notesMode, handleNoteToggle, handleCellChange, grid]);

  // Handle cell click
  const handleCellClick = useCallback((row, col) => {
    if (onCellSelect) {
      onCellSelect([row, col]); // Pass as array, not two separate arguments
    }
  }, [onCellSelect]);

  // Check if cell is original (given)
  const isOriginalCell = useCallback((row, col) => {
    return originalGrid && originalGrid[row] && originalGrid[row][col] !== '';
  }, [originalGrid]);

  // Check if cell is in same row, col, or box as selected
  const isHighlighted = useCallback((row, col) => {
    if (!selectedCell || !Array.isArray(selectedCell)) return { row: false, col: false, box: false };
    
    const [selRow, selCol] = selectedCell;
    const boxRowStart = Math.floor(selRow / boxRows) * boxRows;
    const boxColStart = Math.floor(selCol / boxCols) * boxCols;
    const cellBoxRowStart = Math.floor(row / boxRows) * boxRows;
    const cellBoxColStart = Math.floor(col / boxCols) * boxCols;
    
    return {
      row: row === selRow && col !== selCol,
      col: col === selCol && row !== selRow,
      box: boxRowStart === cellBoxRowStart && boxColStart === cellBoxColStart && (row !== selRow || col !== selCol)
    };
  }, [selectedCell, boxRows, boxCols]);

  // Get cell size based on grid size and viewport width
  const getCellSize = useCallback(() => {
    const isMobile = windowWidth < 768;
    const isSmallMobile = windowWidth < 480;
    
    // For mobile, use viewport-based calculations
    if (isMobile) {
      // Calculate available width (accounting for padding ~32px total)
      const availableWidth = windowWidth - 32;
      
      if (size === 6) {
        const cellSize = isSmallMobile ? Math.floor(availableWidth / 7) : Math.floor(availableWidth / 8);
        return { 
          width: `${cellSize}px`, 
          height: `${cellSize}px`, 
          fontSize: isSmallMobile ? '16px' : '18px' 
        };
      }
      if (size === 9) {
        const cellSize = isSmallMobile ? Math.floor(availableWidth / 10) : Math.floor(availableWidth / 11);
        return { 
          width: `${cellSize}px`, 
          height: `${cellSize}px`, 
          fontSize: isSmallMobile ? '14px' : '16px' 
        };
      }
      if (size === 12) {
        const cellSize = isSmallMobile ? Math.floor(availableWidth / 13) : Math.floor(availableWidth / 14);
        return { 
          width: `${cellSize}px`, 
          height: `${cellSize}px`, 
          fontSize: isSmallMobile ? '10px' : '12px' 
        };
      }
      if (size === 16) {
        const cellSize = isSmallMobile ? Math.floor(availableWidth / 17) : Math.floor(availableWidth / 18);
        return { 
          width: `${cellSize}px`, 
          height: `${cellSize}px`, 
          fontSize: isSmallMobile ? '8px' : '10px' 
        };
      }
      // 25x25 grid
      const cellSize = isSmallMobile ? Math.floor(availableWidth / 26) : Math.floor(availableWidth / 27);
      return { 
        width: `${cellSize}px`, 
        height: `${cellSize}px`, 
        fontSize: isSmallMobile ? '6px' : '8px' 
      };
    }
    
    // Desktop sizes (unchanged)
    if (size === 6) return { width: '52px', height: '52px', fontSize: '20px' };
    if (size === 9) return { width: '48px', height: '48px', fontSize: '20px' };
    if (size === 12) return { width: '40px', height: '40px', fontSize: '16px' };
    if (size === 16) return { width: '36px', height: '36px', fontSize: '14px' };
    return { width: '28px', height: '28px', fontSize: '12px' };
  }, [size, windowWidth]);

  const cellSize = getCellSize();

  // Render notes for a cell
  const renderNotes = (rowIndex, colIndex) => {
    if (!notes || !notes[rowIndex] || !notes[rowIndex][colIndex]) return null;
    
    const cellNotes = notes[rowIndex][colIndex];
    if (cellNotes.size === 0) return null;
    
    const gridSize = size <= 9 ? 3 : size <= 12 ? 4 : size <= 16 ? 4 : 5;
    const isMobile = windowWidth < 768;
    const isSmallMobile = windowWidth < 480;
    
    // Calculate note font size based on screen size and puzzle size
    let noteFontSize = '9px';
    if (size > 16) {
      noteFontSize = isSmallMobile ? '4px' : isMobile ? '5px' : '6px';
    } else if (size > 12) {
      noteFontSize = isSmallMobile ? '6px' : isMobile ? '7px' : '8px';
    } else if (size > 9) {
      noteFontSize = isSmallMobile ? '7px' : isMobile ? '8px' : '9px';
    } else {
      noteFontSize = isSmallMobile ? '8px' : isMobile ? '9px' : '10px';
    }
    
    return (
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${Math.ceil(size / gridSize)}, 1fr)`,
          padding: isMobile ? '1px' : '2px',
        }}
      >
        {Array.from({ length: size }, (_, i) => i + 1).map(num => (
          <div 
            key={num} 
            className="flex items-center justify-center"
            style={{ 
              opacity: cellNotes.has(num) ? 1 : 0,
              fontSize: noteFontSize,
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            {num}
          </div>
        ))}
      </div>
    );
  };

  // Blur overlay when paused
  if (isPaused) {
    return (
      <div className="relative w-full max-w-full">
        <div className="sudoku-grid blur-md opacity-50" style={{
          gridTemplateColumns: `repeat(${size}, ${cellSize.width})`,
          maxWidth: '100%',
          margin: '0 auto',
        }}>
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="sudoku-cell"
                style={{ width: cellSize.width, height: cellSize.height }}
              />
            ))
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="card text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-lg font-semibold">Game Paused</p>
            <p className="text-sm text-[var(--color-text-muted)]">Click resume to continue</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-full" ref={gridRef}>
      <div 
        className="sudoku-grid"
        style={{
          gridTemplateColumns: `repeat(${size}, ${cellSize.width})`,
          maxWidth: '100%',
          margin: '0 auto',
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isOriginal = isOriginalCell(rowIndex, colIndex);
            const hasConflict = conflicts.has(`${rowIndex}-${colIndex}`);
            const isSelected = selectedCell && selectedCell[0] === rowIndex && selectedCell[1] === colIndex;
            const highlight = isHighlighted(rowIndex, colIndex);
            const isAnimating = animatingCells.has(`${rowIndex}-${colIndex}`);
            const wasRecentlyChanged = recentlyChanged.has(`${rowIndex}-${colIndex}`);
            const hasNotes = notes && notes[rowIndex] && notes[rowIndex][colIndex] && notes[rowIndex][colIndex].size > 0;
            const showNotes = hasNotes && cell === '';
            
            // Determine box borders
            const isBoxRight = (colIndex + 1) % boxCols === 0 && colIndex !== size - 1;
            const isBoxBottom = (rowIndex + 1) % boxRows === 0 && rowIndex !== size - 1;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="relative"
                style={{ width: cellSize.width, height: cellSize.height }}
              >
                <input
                  type="text"
                  value={showNotes ? '' : cell}
                  onChange={(e) => handleInputChange(e, rowIndex, colIndex)}
                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`
                    sudoku-cell w-full h-full
                    ${isOriginal ? 'original' : 'user-input'}
                    ${hasConflict ? 'conflict' : ''}
                    ${isSelected ? 'selected' : ''}
                    ${highlight.row || highlight.col || highlight.box ? 'highlight-row' : ''}
                    ${isBoxRight ? 'box-right' : ''}
                    ${isBoxBottom ? 'box-bottom' : ''}
                    ${isAnimating || wasRecentlyChanged ? 'cell-animate' : ''}
                  `}
                  style={{
                    fontSize: showNotes ? '0' : cellSize.fontSize,
                    textAlign: 'center',
                  }}
                  data-row={rowIndex}
                  data-col={colIndex}
                  readOnly={readOnly || isOriginal}
                  maxLength={size > 9 ? 2 : 1}
                />
                {showNotes && renderNotes(rowIndex, colIndex)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SudokuGrid;

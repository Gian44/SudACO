import React from 'react';
import { getValidCharacters, getPuzzleSizeName, getBoxDimensions } from '../utils/sudokuUtils';

const SudokuGrid = ({ 
  grid, 
  onChange, 
  size, 
  readOnly = false, 
  highlightChanges = false,
  originalGrid = null 
}) => {
  const validChars = getValidCharacters(size);
  const { boxRows, boxCols } = getBoxDimensions(size);

  // Handle cell change
  const handleCellChange = (row, col, value) => {
    if (readOnly) return;

    // Validate input
    if (value !== '' && !validChars.includes(value)) {
      return; // Invalid character, ignore
    }

    onChange(row, col, value);
  };

  // Handle keyboard input
  const handleKeyDown = (e, row, col) => {
    if (readOnly) return;

    const { key } = e;
    
    // Handle special keys
    if (key === 'Backspace' || key === 'Delete') {
      handleCellChange(row, col, '');
      e.preventDefault();
      return;
    }

    // Handle arrow keys for navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
      const currentIndex = row * size + col;
      let newIndex = currentIndex;

      switch (key) {
        case 'ArrowUp':
          newIndex = Math.max(0, currentIndex - size);
          break;
        case 'ArrowDown':
          newIndex = Math.min(size * size - 1, currentIndex + size);
          break;
        case 'ArrowLeft':
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ArrowRight':
          newIndex = Math.min(size * size - 1, currentIndex + 1);
          break;
      }

      const newRow = Math.floor(newIndex / size);
      const newCol = newIndex % size;
      
      // Focus the new cell
      setTimeout(() => {
        const newCell = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
        if (newCell) newCell.focus();
      }, 0);
    }
  };

  // Handle input change
  const handleInputChange = (e, row, col) => {
    const value = e.target.value.slice(-1); // Take only the last character
    handleCellChange(row, col, value);
  };

  // Check if cell is original (given)
  const isOriginalCell = (row, col) => {
    return originalGrid && originalGrid[row] && originalGrid[row][col] !== '';
  };

  // Check if cell was changed
  const isChangedCell = (row, col) => {
    return highlightChanges && originalGrid && originalGrid[row] && 
           originalGrid[row][col] === '' && grid[row][col] !== '';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {getPuzzleSizeName(size)} Sudoku
        </h3>
        <div className="flex space-x-4 text-sm">
          <div className="flex items-center">
            <span className="w-3 h-3 bg-gray-200 border border-gray-400 mr-1"></span>
            <span className="text-gray-600">Given</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-blue-100 border border-blue-300 mr-1"></span>
            <span className="text-gray-600">Solved</span>
          </div>
          {highlightChanges && (
            <div className="flex items-center">
              <span className="w-3 h-3 bg-green-100 border border-green-300 mr-1"></span>
              <span className="text-gray-600">Changed</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Responsive grid container */}
      <div className="flex justify-center">
        <div 
          className="grid gap-0 border-2 border-gray-800"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            // Dynamic sizing based on size with better proportions
            width: size === 6 ? 'min(360px, 35vw)' :
                   size === 9 ? 'min(450px, 40vw)' : 
                   size === 12 ? 'min(540px, 50vw)' :
                   size === 16 ? 'min(640px, 60vw)' : 
                   'min(800px, 70vw)',
            height: size === 6 ? 'min(360px, 35vw)' :
                    size === 9 ? 'min(450px, 40vw)' : 
                    size === 12 ? 'min(540px, 50vw)' :
                    size === 16 ? 'min(640px, 60vw)' : 
                    'min(800px, 70vw)',
            maxWidth: size === 6 ? '360px' :
                      size === 9 ? '450px' : 
                      size === 12 ? '540px' :
                      size === 16 ? '640px' : 
                      '800px'
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isOriginal = isOriginalCell(rowIndex, colIndex);
              const isChanged = isChangedCell(rowIndex, colIndex);
              
              // Dynamic cell sizing
              const cellSize = size === 6 ? '60px' :
                              size === 9 ? '50px' : 
                              size === 12 ? '45px' :
                              size === 16 ? '40px' : 
                              '32px';
              
              return (
                <input
                  key={`${rowIndex}-${colIndex}`}
                  type="text"
                  value={cell}
                  onChange={(e) => handleInputChange(e, rowIndex, colIndex)}
                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                  className={`
                    text-center font-semibold border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    ${size <= 9 ? 'text-lg' : size === 12 ? 'text-base' : size === 16 ? 'text-sm' : 'text-xs'}
                    ${isOriginal 
                      ? 'bg-gray-200 text-gray-800 font-bold' 
                      : isChanged 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }
                    ${readOnly ? 'cursor-not-allowed' : 'cursor-text'}
                    ${(colIndex + 1) % boxCols === 0 && colIndex !== size - 1 ? 'border-r-2 border-gray-800' : ''}
                    ${(rowIndex + 1) % boxRows === 0 && rowIndex !== size - 1 ? 'border-b-2 border-gray-800' : ''}
                  `}
                  data-row={rowIndex}
                  data-col={colIndex}
                  readOnly={readOnly}
                  maxLength={1}
                  placeholder=""
                  style={{
                    width: cellSize,
                    height: cellSize,
                    minWidth: cellSize,
                    minHeight: cellSize
                  }}
                />
              );
            })
          )}
        </div>
      </div>
      
      <div className="mt-3 text-sm text-gray-600 space-y-1">
        <p>Use arrow keys to navigate between cells</p>
        <p>Valid characters: {validChars.join(', ')}</p>
      </div>
    </div>
  );
};

export default SudokuGrid;
import React, { useState, useEffect, useCallback } from 'react';
import { getDailyPuzzle, getDailyPuzzleForDate, isDailyCompleted, getDifficultyInfo, calculateDifficulty, getDailyPuzzleInfo } from '../utils/dailyPuzzleService';
import { parseInstanceFile, getInstanceFileFormatDescription } from '../utils/fileParser';
import { stringToGrid } from '../utils/sudokuUtils';
import { loadPuzzlesFromServer, checkServerHealth } from '../utils/apiClient';
import DifficultyBadge from './DifficultyBadge';

const PuzzleSelectionModal = ({ isOpen, onClose, onPuzzleSelect }) => {
  const [activeTab, setActiveTab] = useState('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Daily puzzle info
  const [dailyInfo, setDailyInfo] = useState(null);
  
  // Library state
  const [categories, setCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [selectedLibrarySize, setSelectedLibrarySize] = useState('9x9');
  const [selectedFillPercent, setSelectedFillPercent] = useState('50');
  const [puzzleList, setPuzzleList] = useState([]);
  
  // Upload state
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  
  // Previous daily puzzles
  const [previousDailyPuzzles, setPreviousDailyPuzzles] = useState([]);

  // Load daily puzzle info and puzzle index
  useEffect(() => {
    const loadData = async () => {
      // Get daily puzzle info
      const info = getDailyPuzzleInfo();
      setDailyInfo(info);
      
      // Load daily puzzles from server/KV first, then fallback to localStorage
      const allPuzzles = [];
      
      try {
        // Try to load from server/KV
        const serverOk = await checkServerHealth();
        if (serverOk) {
          try {
            const response = await fetch('/api/puzzles/daily-list');
            if (response.ok) {
              const serverPuzzles = await response.json();
              // Add server puzzles with source marker
              serverPuzzles.forEach(puzzle => {
                allPuzzles.push({
                  ...puzzle,
                  source: 'server',
                  // Format date display nicely
                  dateDisplay: new Date(puzzle.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })
                });
              });
            }
          } catch (apiErr) {
            console.warn('Failed to load daily puzzles from server:', apiErr);
          }
        }
      } catch (err) {
        console.warn('Server check failed:', err);
      }
      
      // Also load from localStorage (for puzzles generated on client)
      const today = new Date();
      for (let i = 0; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateISO = date.toISOString().split('T')[0];
        const cacheKey = `daily-puzzle-${dateISO}`;
        
        // Skip if already loaded from server
        if (allPuzzles.some(p => p.date === dateISO)) {
          continue;
        }
        
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const puzzleData = JSON.parse(cached);
            allPuzzles.push({
              date: dateISO,
              dateDisplay: date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              }),
              size: puzzleData.size,
              difficulty: puzzleData.difficulty,
              filename: puzzleData.filename,
              source: 'local'
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
      
      // Sort by date (newest first)
      allPuzzles.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setPreviousDailyPuzzles(allPuzzles);
      
      // Load puzzle categories
      try {
        const serverOk = await checkServerHealth();
        let data;
        if (serverOk) {
          try {
            data = await loadPuzzlesFromServer();
          } catch (apiError) {
            // If API fails, fall back to static file
            console.warn('API failed, falling back to static file:', apiError);
            const response = await fetch('/instances/index.json');
            if (!response.ok) {
              throw new Error(`Failed to fetch index: ${response.status}`);
            }
            data = await response.json();
          }
        } else {
          const response = await fetch('/instances/index.json');
          if (!response.ok) {
            throw new Error(`Failed to fetch index: ${response.status}`);
          }
          data = await response.json();
        }
        setCategories(data);
        setError(''); // Clear any previous errors
      } catch (err) {
        console.error('Failed to load puzzle index:', err);
        setError(`Failed to load puzzle library: ${err.message}`);
      }
    };
    
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Initialize selected values when categories are loaded
  useEffect(() => {
    if (!categories || Object.keys(categories).length === 0) {
      return;
    }

    // Filter out daily-puzzles from available categories
    const availableCategories = Object.keys(categories).filter(cat => cat !== 'daily-puzzles');

    // If selected category doesn't exist or is daily-puzzles, set to first available
    if (!categories[selectedCategory] || selectedCategory === 'daily-puzzles') {
      if (availableCategories.length > 0) {
        const firstCategory = availableCategories[0];
        setSelectedCategory(firstCategory);
        
        // If it's general, initialize size and fill
        if (firstCategory === 'general' && categories.general) {
          const sizes = Object.keys(categories.general);
          if (sizes.length > 0) {
            setSelectedLibrarySize(sizes[0]);
            const fills = Object.keys(categories.general[sizes[0]]);
            if (fills.length > 0) {
              setSelectedFillPercent(fills[0]);
            }
          }
        }
      }
    } else if (selectedCategory === 'general' && categories.general) {
      // Ensure selected size exists
      const sizes = Object.keys(categories.general);
      if (sizes.length > 0) {
        if (!categories.general[selectedLibrarySize]) {
          setSelectedLibrarySize(sizes[0]);
          const fills = Object.keys(categories.general[sizes[0]]);
          if (fills.length > 0) {
            setSelectedFillPercent(fills[0]);
          }
        } else {
          // Ensure selected fill exists for current size
          const fills = Object.keys(categories.general[selectedLibrarySize]);
          if (fills.length > 0 && !categories.general[selectedLibrarySize][selectedFillPercent]) {
            setSelectedFillPercent(fills[0]);
          }
        }
      }
    }
  }, [categories, selectedCategory, selectedLibrarySize, selectedFillPercent]);

  // Update puzzle list when category/size/fill changes
  useEffect(() => {
    if (selectedCategory === 'general' && categories.general) {
      const sizeData = categories.general[selectedLibrarySize];
      if (sizeData && sizeData[selectedFillPercent]) {
        setPuzzleList(sizeData[selectedFillPercent]);
      } else {
        setPuzzleList([]);
      }
    } else if (categories[selectedCategory]) {
      // Handle array-based categories (like logic-solvable)
      if (Array.isArray(categories[selectedCategory])) {
        setPuzzleList(categories[selectedCategory]);
      } else {
        setPuzzleList([]);
      }
    } else {
      setPuzzleList([]);
    }
  }, [selectedCategory, selectedLibrarySize, selectedFillPercent, categories]);

  // Handle daily puzzle selection
  const handleDailySelect = useCallback(async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Get today's daily puzzle (no parameters - random size/difficulty)
      const puzzleData = await getDailyPuzzle();
      const grid = stringToGrid(puzzleData.puzzleString, puzzleData.size);
      
      onPuzzleSelect({
        grid,
        size: puzzleData.size,
        puzzleString: puzzleData.puzzleString,
        difficulty: puzzleData.difficulty,
        isDaily: true,
        source: puzzleData.source
      });
      
      onClose();
    } catch (err) {
      setError(`Failed to load daily puzzle: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [onPuzzleSelect, onClose]);

  // Handle previous daily puzzle selection
  const handlePreviousDailySelect = useCallback(async (dateISO) => {
    setIsLoading(true);
    setError('');
    
    try {
      const puzzleData = await getDailyPuzzleForDate(dateISO);
      const grid = stringToGrid(puzzleData.puzzleString, puzzleData.size);
      
      onPuzzleSelect({
        grid,
        size: puzzleData.size,
        puzzleString: puzzleData.puzzleString,
        difficulty: puzzleData.difficulty,
        isDaily: true,
        source: puzzleData.source
      });
      
      onClose();
    } catch (err) {
      setError(`Failed to load daily puzzle: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [onPuzzleSelect, onClose]);

  // Handle library puzzle selection
  const handleLibrarySelect = useCallback(async (puzzleFile) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Try API endpoint first (for production)
      let fileContent = null;
      let response = null;
      
      try {
        response = await fetch(`/api/puzzles/load?category=${encodeURIComponent(selectedCategory)}&file=${encodeURIComponent(puzzleFile)}`);
        if (response.ok) {
          fileContent = await response.text();
        } else if (response.status === 404) {
          // Puzzle not available in production
          const errorData = await response.json();
          throw new Error(errorData.message || 'Puzzle file not available in production. Please use Daily puzzles or upload your own.');
        }
      } catch (apiErr) {
        // Fallback to direct file fetch (for development)
        console.warn('API failed, trying direct file fetch:', apiErr);
        const puzzlePath = `/instances/${selectedCategory}/${puzzleFile}`;
        response = await fetch(puzzlePath);
        
        if (!response.ok) {
          throw new Error(`Puzzle file not available. In production, library puzzles are not included. Please use Daily puzzles or upload your own puzzle file.`);
        }
        
        fileContent = await response.text();
      }
      
      if (!fileContent) {
        throw new Error('Failed to load puzzle file');
      }
      
      const { size, puzzleString } = parseInstanceFile(fileContent);
      const grid = stringToGrid(puzzleString, size);
      const difficulty = calculateDifficulty(puzzleString, size);
      
      onPuzzleSelect({
        grid,
        size,
        puzzleString,
        difficulty,
        isDaily: false,
        fileName: puzzleFile
      });
      
      onClose();
    } catch (err) {
      setError(`Failed to load puzzle: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, onPuzzleSelect, onClose]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file) => {
    setUploadError('');
    
    try {
      const content = await file.text();
      const { size, puzzleString } = parseInstanceFile(content);
      const grid = stringToGrid(puzzleString, size);
      const difficulty = calculateDifficulty(puzzleString, size);
      
      onPuzzleSelect({
        grid,
        size,
        puzzleString,
        difficulty,
        isDaily: false,
        fileName: file.name
      });
      
      onClose();
    } catch (err) {
      setUploadError(`Invalid file format: ${err.message}`);
    }
  }, [onPuzzleSelect, onClose]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.txt')) {
      handleFileUpload(file);
    } else {
      setUploadError('Please upload a .txt file');
    }
  }, [handleFileUpload]);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  if (!isOpen) return null;

  const difficultyInfo = dailyInfo ? getDifficultyInfo(dailyInfo.difficulty) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gradient">Select Puzzle</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="tab-list">
          <button
            className={`tab ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            <span className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span className="text-xs sm:text-sm">Daily</span>
            </span>
          </button>
          <button
            className={`tab ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <span className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
              <span className="text-xs sm:text-sm">Library</span>
            </span>
          </button>
          <button
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <span className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-xs sm:text-sm">Upload</span>
            </span>
          </button>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-error)]/20 border border-[var(--color-error)]/50 text-[var(--color-error)]">
            {error}
          </div>
        )}
        
        {/* Daily Tab */}
        {activeTab === 'daily' && (
          <div className="space-y-4 sm:space-y-6">
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
              Play today's daily puzzle! A new random puzzle is generated each day.
            </p>
            
            {/* Today's Puzzle Info */}
            <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold">Today's Challenge</h3>
                    <p className="text-xs sm:text-sm text-[var(--color-text-muted)] truncate">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                {dailyInfo?.isCompleted && (
                  <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-[var(--color-success)]/20 text-[var(--color-success)] flex-shrink-0">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs sm:text-sm font-medium">Completed</span>
                  </div>
                )}
              </div>
              
              {dailyInfo && (
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[var(--color-bg-elevated)]">
                    <span className="text-xl sm:text-2xl font-bold">{dailyInfo.size}×{dailyInfo.size}</span>
                  </div>
                  {difficultyInfo && (
                    <DifficultyBadge difficulty={dailyInfo.difficulty} />
                  )}
                </div>
              )}
            </div>
            
            {/* Play Button */}
            <button
              onClick={handleDailySelect}
              disabled={isLoading}
              className="btn btn-primary w-full py-3 sm:py-4 text-sm sm:text-lg"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="spinner" />
                  Loading...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  {dailyInfo?.isCompleted ? 'Play Again' : 'Play Daily Puzzle'}
                </span>
              )}
            </button>
            
            {/* Daily Puzzles Collection */}
            <div className="mt-4 sm:mt-6">
              <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-[var(--color-text-primary)]">
                Daily Puzzles Collection
              </h3>
              {previousDailyPuzzles.length > 0 ? (
                <>
                  <div className="max-h-80 sm:max-h-96 overflow-y-auto space-y-1.5 sm:space-y-2 rounded-lg bg-[var(--color-bg-secondary)] p-2 sm:p-3">
                    {previousDailyPuzzles.map((puzzle) => (
                      <button
                        key={puzzle.date}
                        onClick={() => handlePreviousDailySelect(puzzle.date)}
                        disabled={isLoading}
                        className="w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors flex items-center justify-between group gap-2"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm sm:text-base text-[var(--color-text-primary)] truncate">
                              {puzzle.dateDisplay}
                            </div>
                            <div className="text-xs sm:text-sm text-[var(--color-text-muted)] flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span>{puzzle.size}×{puzzle.size}</span>
                              <span>•</span>
                              <span className="capitalize">{puzzle.difficulty}</span>
                            </div>
                          </div>
                        </div>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-2 px-1">
                    {previousDailyPuzzles.filter(p => p.source === 'server').length > 0 
                      ? `Showing ${previousDailyPuzzles.length} daily puzzles from server and local cache.`
                      : 'Showing puzzles from your browser cache. Puzzles can be generated on-demand for any date.'}
                  </p>
                </>
              ) : (
                <div className="p-4 sm:p-6 rounded-lg bg-[var(--color-bg-secondary)] text-center">
                  <p className="text-sm sm:text-base text-[var(--color-text-muted)]">
                    No previous daily puzzles found. Play today's puzzle to get started!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Library Tab */}
        {activeTab === 'library' && (
          <div className="space-y-3 sm:space-y-4">
            {/* Category and Size Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="select w-full text-sm"
                >
                  {Object.keys(categories)
                    .filter(cat => cat !== 'daily-puzzles')
                    .map(cat => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                </select>
              </div>
              
              {selectedCategory === 'general' && (
                <>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Size</label>
                    <select
                      value={selectedLibrarySize}
                      onChange={(e) => setSelectedLibrarySize(e.target.value)}
                      className="select w-full text-sm"
                    >
                      {categories.general && Object.keys(categories.general).map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Fill %</label>
                    <select
                      value={selectedFillPercent}
                      onChange={(e) => setSelectedFillPercent(e.target.value)}
                      className="select w-full text-sm"
                    >
                      {categories.general && categories.general[selectedLibrarySize] && 
                        Object.keys(categories.general[selectedLibrarySize]).map(fill => (
                          <option key={fill} value={fill}>{fill}%</option>
                        ))
                      }
                    </select>
                  </div>
                </>
              )}
            </div>
            
            {/* Puzzle List */}
            <div className="max-h-60 sm:max-h-80 overflow-y-auto space-y-1.5 sm:space-y-2 rounded-lg bg-[var(--color-bg-secondary)] p-2 sm:p-3">
              {puzzleList.length === 0 ? (
                <p className="text-center text-[var(--color-text-muted)] py-4 text-sm">No puzzles found</p>
              ) : (
                puzzleList.slice(0, 50).map((puzzle) => (
                  <button
                    key={puzzle}
                    onClick={() => handleLibrarySelect(puzzle)}
                    disabled={isLoading}
                    className="w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-sm sm:text-base truncate flex-1 min-w-0">{puzzle}</span>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))
              )}
              {puzzleList.length > 50 && (
                <p className="text-center text-[var(--color-text-muted)] text-xs sm:text-sm pt-2">
                  Showing first 50 of {puzzleList.length} puzzles
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
              Upload a custom puzzle file in .txt format.
            </p>
            
            {/* Drop zone */}
            <div
              className={`upload-zone ${dragOver ? 'dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-base sm:text-lg font-medium mb-1">Drop your puzzle file here</p>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">or click to browse</p>
              <input
                id="file-input"
                type="file"
                accept=".txt"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
            
            {/* Upload error */}
            {uploadError && (
              <div className="p-3 sm:p-4 rounded-lg bg-[var(--color-error)]/20 border border-[var(--color-error)]/50">
                <p className="text-sm sm:text-base text-[var(--color-error)] font-medium mb-2">{uploadError}</p>
                <details className="text-xs sm:text-sm">
                  <summary className="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    Show expected format
                  </summary>
                  <pre className="mt-2 text-xs p-2 sm:p-3 rounded bg-[var(--color-bg-secondary)] overflow-x-auto">
                    {getInstanceFileFormatDescription()}
                  </pre>
                </details>
              </div>
            )}
            
            {/* Format help */}
            <details className="text-xs sm:text-sm">
              <summary className="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                What format should my file be in?
              </summary>
              <pre className="mt-2 text-xs p-2 sm:p-3 rounded bg-[var(--color-bg-secondary)] overflow-x-auto">
                {getInstanceFileFormatDescription()}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default PuzzleSelectionModal;

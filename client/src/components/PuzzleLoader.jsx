import React, { useState, useEffect } from 'react';
import { parseInstanceFile, getInstanceFileFormatDescription } from '../utils/fileParser';
import { stringToGrid } from '../utils/sudokuUtils';
import { generatePuzzle } from '../utils/puzzleGenerator';
import { 
  getNextPuzzleNumber, 
  generatePuzzleFilename, 
  addGeneratedPuzzle,
  getGeneratedPuzzles,
  getGenerationAlgorithmOptions,
  getFillPercentageOptions,
  getCategoryFromSize
} from '../utils/fileSystemManager';
import { 
  savePuzzleToServer, 
  loadPuzzlesFromServer, 
  checkServerHealth,
  getFallbackMessage 
} from '../utils/apiClient';
import { getDefaultParameters } from '../utils/wasmBridge';

function PuzzleLoader({ onPuzzleLoad, onError }) {
  const [categories, setCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedFillPercent, setSelectedFillPercent] = useState('');
  const [selectedPuzzle, setSelectedPuzzle] = useState('');
  const [uploadError, setUploadError] = useState('');
  
  // Puzzle generation state
  const [generationAlgorithm, setGenerationAlgorithm] = useState(2);
  const [generationFillPercent, setGenerationFillPercent] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const [serverAvailable, setServerAvailable] = useState(false);

  useEffect(() => {
    // Check server availability and load puzzles
    const initializePuzzles = async () => {
      try {
        // Check if server is available
        const serverOk = await checkServerHealth();
        setServerAvailable(serverOk);
        
        let data;
        if (serverOk) {
          // Load from server (includes generated puzzles)
          data = await loadPuzzlesFromServer();
          setCategories(data);
        } else {
          // Fallback to loading from file
          const response = await fetch('/instances/index.json');
          data = await response.json();
          setCategories(data);
        }
        
        // Set initial category selection
        const firstCategory = Object.keys(data)[0];
        if (firstCategory) {
          setSelectedCategory(firstCategory);
          
          // Handle hierarchical structure for general category
          if (firstCategory === 'general' && data[firstCategory]) {
            const firstSize = Object.keys(data[firstCategory])[0];
            if (firstSize) {
              setSelectedSize(firstSize);
              const firstFillPercent = Object.keys(data[firstCategory][firstSize])[0];
              if (firstFillPercent) {
                setSelectedFillPercent(firstFillPercent);
                setSelectedPuzzle(data[firstCategory][firstSize][firstFillPercent][0]);
              }
            }
          } else if (data[firstCategory] && Array.isArray(data[firstCategory])) {
            // Handle flat structure for logic-solvable
            setSelectedPuzzle(data[firstCategory][0]);
          }
        }
      } catch (error) {
        console.error('Error loading puzzles:', error);
        onError('Failed to load puzzle index');
      }
    };
    
    initializePuzzles();
  }, [onError]);

  const handleLoadSelectedPuzzle = async () => {
    if (!selectedCategory || !selectedPuzzle) return;
    
    try {
      // First check if it's a generated puzzle in local storage
      const generatedPuzzles = getGeneratedPuzzles();
      let puzzleString = null;
      let size = null;
      
      // Check for generated puzzle
      if (selectedCategory === 'general' && selectedSize && selectedFillPercent) {
        const generated = generatedPuzzles.general?.[selectedSize]?.[selectedFillPercent] || [];
        const puzzle = generated.find(p => p.filename === selectedPuzzle);
        if (puzzle) {
          puzzleString = puzzle.puzzleString;
          size = parseInt(selectedSize.split('x')[0]);
        }
      } else if (selectedCategory && generatedPuzzles[selectedCategory]) {
        const sizeKey = selectedCategory === '6x6' ? '6x6' : selectedCategory === '12x12' ? '12x12' : null;
        if (sizeKey && generatedPuzzles[selectedCategory][sizeKey]) {
          Object.keys(generatedPuzzles[selectedCategory][sizeKey]).forEach(percent => {
            const generated = generatedPuzzles[selectedCategory][sizeKey][percent] || [];
            const puzzle = generated.find(p => p.filename === selectedPuzzle);
            if (puzzle) {
              puzzleString = puzzle.puzzleString;
              size = parseInt(sizeKey.split('x')[0]);
            }
          });
        }
      }
      
      // If not found in local storage, load from file
      if (!puzzleString) {
        const puzzlePath = `/instances/${selectedCategory}/${selectedPuzzle}`;
        
        console.log('Loading puzzle from:', puzzlePath);
        
        const response = await fetch(puzzlePath, {
          headers: {
            'Accept': 'text/plain, text/*, */*'
          }
        });
        console.log('Response status:', response.status, response.statusText);
        console.log('Response content-type:', response.headers.get('content-type'));
        
        if (!response.ok) {
          throw new Error(`Failed to fetch puzzle: ${response.status} ${response.statusText}`);
        }
        
        const fileContent = await response.text();
        console.log('File content preview:', fileContent.substring(0, 100));
        
        const parsed = parseInstanceFile(fileContent);
        puzzleString = parsed.puzzleString;
        size = parsed.size;
      }
      
      onPuzzleLoad(puzzleString, size, selectedPuzzle);
      setUploadError('');
    } catch (error) {
      const errorMsg = `Error loading puzzle: ${error.message}`;
      setUploadError(errorMsg);
      onError(errorMsg);
    }
  };

  // Auto-load puzzle when selection changes
  useEffect(() => {
    if (selectedCategory && selectedPuzzle) {
      handleLoadSelectedPuzzle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPuzzle]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileContent = e.target.result;
        const { size, puzzleString } = parseInstanceFile(fileContent);
        onPuzzleLoad(puzzleString, size, file.name);
        setUploadError('');
      } catch (error) {
        const errorMsg = `Error parsing uploaded file: ${error.message}`;
        setUploadError(errorMsg);
        onError(errorMsg);
      }
    };
    reader.readAsText(file);
  };

  const handleCreatePuzzle = async () => {
    if (!selectedCategory) {
      setGenerationMessage('Please select a category first');
      return;
    }

    setIsGenerating(true);
    setGenerationMessage('');

    try {
      // Determine puzzle size from category
      let puzzleSize;
      if (selectedCategory === '6x6') {
        puzzleSize = 6;
      } else if (selectedCategory === '12x12') {
        puzzleSize = 12;
      } else if (selectedCategory === 'general') {
        // For general category, use the selected size
        if (!selectedSize) {
          throw new Error('Please select a puzzle size for general category');
        }
        puzzleSize = parseInt(selectedSize.split('x')[0]); // Extract size from "9x9" format
      } else {
        throw new Error('Puzzle generation not supported for this category');
      }

      // Get algorithm parameters with size-aware timeout
      const defaultParams = getDefaultParameters(puzzleSize)[generationAlgorithm];

      // Generate puzzle
      const result = await generatePuzzle(puzzleSize, generationAlgorithm, generationFillPercent, defaultParams);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Determine category for file storage
      const fileCategory = getCategoryFromSize(puzzleSize);

      let filename;
      if (serverAvailable) {
        // Save to server (which saves to file system and updates index.json)
        const saveResult = await savePuzzleToServer(fileCategory, puzzleSize, generationFillPercent, result.instanceContent, result.puzzleString);
        filename = saveResult.filename;
        
        // Reload categories from server to include the new puzzle
        const updatedCategories = await loadPuzzlesFromServer();
        setCategories(updatedCategories);
      } else {
        // Fallback to local storage (only if server is truly unavailable)
        const nextNumber = getNextPuzzleNumber(fileCategory, puzzleSize, generationFillPercent, categories);
        filename = generatePuzzleFilename(puzzleSize, generationFillPercent, nextNumber);
        addGeneratedPuzzle(fileCategory, puzzleSize, generationFillPercent, filename, result.instanceContent, result.puzzleString);
      }

      // Auto-load the generated puzzle
      onPuzzleLoad(result.puzzleString, puzzleSize, filename);

      const message = serverAvailable 
        ? `✓ Puzzle generated and saved to file system! File: ${filename}`
        : `✓ Puzzle generated and saved to browser storage! File: ${filename}`;
      setGenerationMessage(message);
      setUploadError(''); // Clear any previous errors

    } catch (error) {
      const errorMsg = `Error generating puzzle: ${error.message}`;
      setGenerationMessage(errorMsg);
      onError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Load Puzzle</h3>
      
      <div className="space-y-4">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              // Reset dependent selections
              setSelectedSize('');
              setSelectedFillPercent('');
              setSelectedPuzzle('');
              
              // Set initial values based on category type
              if (e.target.value === 'general' && categories[e.target.value]) {
                const firstSize = Object.keys(categories[e.target.value])[0];
                if (firstSize) {
                  setSelectedSize(firstSize);
                  const firstFillPercent = Object.keys(categories[e.target.value][firstSize])[0];
                  if (firstFillPercent) {
                    setSelectedFillPercent(firstFillPercent);
                    setSelectedPuzzle(categories[e.target.value][firstSize][firstFillPercent][0]);
                  }
                }
              } else if (categories[e.target.value] && Array.isArray(categories[e.target.value])) {
                setSelectedPuzzle(categories[e.target.value][0]);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Object.keys(categories).map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Size Selection - Only for general category */}
        {selectedCategory === 'general' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Puzzle Size:
            </label>
            <select
              value={selectedSize}
              onChange={(e) => {
                setSelectedSize(e.target.value);
                setSelectedFillPercent('');
                setSelectedPuzzle('');
                
                if (e.target.value && categories.general[e.target.value]) {
                  const firstFillPercent = Object.keys(categories.general[e.target.value])[0];
                  if (firstFillPercent) {
                    setSelectedFillPercent(firstFillPercent);
                    setSelectedPuzzle(categories.general[e.target.value][firstFillPercent][0]);
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {selectedCategory === 'general' && Object.keys(categories.general || {}).map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Fill Percentage Selection - Only for general category */}
        {selectedCategory === 'general' && selectedSize && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fill Percentage:
            </label>
            <select
              value={selectedFillPercent}
              onChange={(e) => {
                setSelectedFillPercent(e.target.value);
                setSelectedPuzzle('');
                
                if (e.target.value && categories.general[selectedSize][e.target.value]) {
                  setSelectedPuzzle(categories.general[selectedSize][e.target.value][0]);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {selectedSize && Object.keys(categories.general[selectedSize] || {}).map(fillPercent => (
                <option key={fillPercent} value={fillPercent}>
                  {fillPercent}%
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Puzzle Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Puzzle:
          </label>
          <select
            value={selectedPuzzle}
            onChange={(e) => setSelectedPuzzle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {(() => {
              let puzzleList = [];
              
              // Get puzzles from index.json
              if (selectedCategory === 'general' && selectedSize && selectedFillPercent) {
                puzzleList = categories.general[selectedSize][selectedFillPercent] || [];
              } else if (selectedCategory && categories[selectedCategory] && Array.isArray(categories[selectedCategory])) {
                puzzleList = categories[selectedCategory] || [];
              }
              
              // Add generated puzzles from local storage
              const generatedPuzzles = getGeneratedPuzzles();
              if (selectedCategory === 'general' && selectedSize && selectedFillPercent) {
                const generated = generatedPuzzles.general?.[selectedSize]?.[selectedFillPercent] || [];
                puzzleList = [...puzzleList, ...generated.map(p => p.filename)];
              } else if (selectedCategory && generatedPuzzles[selectedCategory]) {
                const sizeKey = selectedCategory === '6x6' ? '6x6' : selectedCategory === '12x12' ? '12x12' : null;
                if (sizeKey && generatedPuzzles[selectedCategory][sizeKey]) {
                  // For simple categories, we need to get all generated puzzles
                  Object.keys(generatedPuzzles[selectedCategory][sizeKey]).forEach(percent => {
                    const generated = generatedPuzzles[selectedCategory][sizeKey][percent] || [];
                    puzzleList = [...puzzleList, ...generated.map(p => p.filename)];
                  });
                }
              }
              
              return puzzleList.map(puzzle => (
                <option key={puzzle} value={puzzle}>
                  {puzzle}
                </option>
              ));
            })()}
          </select>
        </div>


        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or</span>
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Custom Puzzle:
          </label>
          <input
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload a .txt file in the instance format
          </p>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or</span>
          </div>
        </div>

        {/* Create Puzzle Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Create New Puzzle:
          </label>
          
          <div className="space-y-3">
            {/* Algorithm Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Algorithm:
              </label>
              <select
                value={generationAlgorithm}
                onChange={(e) => setGenerationAlgorithm(parseInt(e.target.value))}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {getGenerationAlgorithmOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fill Percentage Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fill Percentage:
              </label>
              <select
                value={generationFillPercent}
                onChange={(e) => setGenerationFillPercent(parseInt(e.target.value))}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {getFillPercentageOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreatePuzzle}
              disabled={isGenerating || !selectedCategory}
              className={`w-full py-2 px-4 rounded-md font-medium transition-colors text-sm ${
                isGenerating || !selectedCategory
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
              }`}
            >
              {isGenerating ? 'Generating...' : 'Create Puzzle'}
            </button>

            {/* Generation Message */}
            {generationMessage && (
              <div className={`text-xs p-2 rounded ${
                generationMessage.startsWith('✓') 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {generationMessage}
              </div>
            )}

            {/* Server Status */}
            <div className={`text-xs p-2 rounded ${
              serverAvailable 
                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}>
              {serverAvailable 
                ? '✓ Server connected - Puzzles will be saved to file system' 
                : '⚠ Server offline - Puzzles will be saved to browser storage only'
              }
            </div>
          </div>
        </div>

        {/* Error Display */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800 font-medium mb-2">Upload Error:</div>
            <div className="text-red-700 text-sm mb-3">{uploadError}</div>
            <details className="text-sm">
              <summary className="text-red-600 cursor-pointer hover:text-red-800 font-medium">
                Show expected file format
              </summary>
              <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded border overflow-x-auto">
                {getInstanceFileFormatDescription()}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default PuzzleLoader;
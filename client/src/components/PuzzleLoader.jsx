import React, { useState, useEffect } from 'react';
import { parseInstanceFile, getInstanceFileFormatDescription } from '../utils/fileParser';
import { stringToGrid } from '../utils/sudokuUtils';

function PuzzleLoader({ onPuzzleLoad, onError }) {
  const [categories, setCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedFillPercent, setSelectedFillPercent] = useState('');
  const [selectedPuzzle, setSelectedPuzzle] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    // Load instance index
    fetch('/instances/index.json')
      .then(response => response.json())
      .then(data => {
        setCategories(data);
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
      })
      .catch(error => {
        console.error('Error loading instance index:', error);
        onError('Failed to load puzzle index');
      });
  }, [onError]);

  const handleLoadSelectedPuzzle = async () => {
    if (!selectedCategory || !selectedPuzzle) return;
    
    try {
      // All puzzle files are directly in their category folders
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
      
      const { size, puzzleString } = parseInstanceFile(fileContent);
      onPuzzleLoad(puzzleString, size, selectedPuzzle);
      setUploadError('');
    } catch (error) {
      const errorMsg = `Error loading puzzle: ${error.message}`;
      setUploadError(errorMsg);
      onError(errorMsg);
    }
  };

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
              if (selectedCategory === 'general' && selectedSize && selectedFillPercent) {
                puzzleList = categories.general[selectedSize][selectedFillPercent] || [];
              } else if (selectedCategory && categories[selectedCategory] && Array.isArray(categories[selectedCategory])) {
                puzzleList = categories[selectedCategory] || [];
              }
              
              return puzzleList.map(puzzle => (
                <option key={puzzle} value={puzzle}>
                  {puzzle}
                </option>
              ));
            })()}
          </select>
        </div>

        {/* Load Button */}
        <button
          onClick={handleLoadSelectedPuzzle}
          disabled={!selectedCategory || !selectedPuzzle}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            !selectedCategory || !selectedPuzzle
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          }`}
        >
          Load Selected Puzzle
        </button>

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
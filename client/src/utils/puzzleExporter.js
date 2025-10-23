// Utility to export generated puzzles from localStorage to actual files
// This can be used during development to persist generated puzzles

/**
 * Export generated puzzles from localStorage to file format
 * Run this in browser console to get the data, then save to files
 */
export function exportGeneratedPuzzlesToFiles() {
  const generatedPuzzles = JSON.parse(localStorage.getItem('sudoku_generated_puzzles') || '{}');
  
  if (Object.keys(generatedPuzzles).length === 0) {
    console.log('No generated puzzles found in localStorage');
    return;
  }
  
  console.log('Generated puzzles found:');
  console.log(JSON.stringify(generatedPuzzles, null, 2));
  
  // Generate file contents for each puzzle
  const filesToCreate = [];
  
  Object.keys(generatedPuzzles).forEach(category => {
    const categoryData = generatedPuzzles[category];
    
    Object.keys(categoryData).forEach(sizeKey => {
      const sizeData = categoryData[sizeKey];
      
      Object.keys(sizeData).forEach(percentKey => {
        const puzzles = sizeData[percentKey];
        
        puzzles.forEach(puzzle => {
          filesToCreate.push({
            category,
            size: sizeKey,
            percent: percentKey,
            filename: puzzle.filename,
            content: puzzle.content,
            puzzleString: puzzle.puzzleString
          });
        });
      });
    });
  });
  
  console.log('\nFiles to create:');
  filesToCreate.forEach(file => {
    console.log(`\n--- ${file.category}/${file.filename} ---`);
    console.log(file.content);
  });
  
  return filesToCreate;
}

/**
 * Generate index.json update for generated puzzles
 */
export function generateIndexUpdate() {
  const generatedPuzzles = JSON.parse(localStorage.getItem('sudoku_generated_puzzles') || '{}');
  
  if (Object.keys(generatedPuzzles).length === 0) {
    console.log('No generated puzzles found');
    return null;
  }
  
  const indexUpdate = {};
  
  Object.keys(generatedPuzzles).forEach(category => {
    const categoryData = generatedPuzzles[category];
    
    if (category === 'general') {
      indexUpdate.general = {};
      
      Object.keys(categoryData).forEach(sizeKey => {
        indexUpdate.general[sizeKey] = {};
        const sizeData = categoryData[sizeKey];
        
        Object.keys(sizeData).forEach(percentKey => {
          const puzzles = sizeData[percentKey];
          indexUpdate.general[sizeKey][percentKey] = puzzles.map(p => p.filename);
        });
      });
    } else {
      // Simple categories (6x6, 12x12)
      const allPuzzles = [];
      
      Object.keys(categoryData).forEach(sizeKey => {
        const sizeData = categoryData[sizeKey];
        
        Object.keys(sizeData).forEach(percentKey => {
          const puzzles = sizeData[percentKey];
          allPuzzles.push(...puzzles.map(p => p.filename));
        });
      });
      
      indexUpdate[category] = allPuzzles;
    }
  });
  
  console.log('Index.json update:');
  console.log(JSON.stringify(indexUpdate, null, 2));
  
  return indexUpdate;
}

/**
 * Instructions for manually saving generated puzzles
 */
export function printSaveInstructions() {
  console.log(`
=== Instructions to Save Generated Puzzles ===

1. Run exportGeneratedPuzzlesToFiles() in browser console
2. Copy the file contents shown
3. Create files in client/public/instances/{category}/ directory
4. Update client/public/instances/index.json with the new puzzles

Example for 6x6 puzzle:
- Create file: client/public/instances/6x6/inst6x6_50_0.txt
- Add content from console output
- Update index.json to include the new filename

For general category puzzles:
- Create file: client/public/instances/general/{size}/{percent}/inst{size}x{size}_{percent}_{number}.txt
- Update the nested structure in index.json

Note: This is a development-time process. In production, puzzles are stored in localStorage.
`);
}

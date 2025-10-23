// Test script to verify all algorithms work with different puzzle sizes
// This script tests the WASM solver with various configurations

import { solveSudoku } from './wasmBridge';

// Test puzzles for different sizes
const testPuzzles = {
  order3: {
    easy: "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
    medium: "..53.....8......2..7..1.5..4....53...1..7..6..32..8..6.5....9..4....3..97..43..",
    hard: "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4.."
  },
  order4: {
    // 16x16 puzzle (simplified for testing)
    sample: "123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef.123456789abcdef."
  },
  order5: {
    // 25x25 puzzle (simplified for testing)
    sample: "abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy.abcdefghijklmnopqrstuvwxy."
  }
};

// Algorithm configurations
const algorithms = [
  { id: 1, name: 'Backtracking', params: { timeout: 5.0 } },
  { id: 0, name: 'ACS', params: { nAnts: 4, q0: 0.9, rho: 0.9, evap: 0.005, timeout: 5.0 } },
  { id: 2, name: 'DCM-ACO', params: { nAnts: 4, numColonies: 3, numACS: 2, q0: 0.9, rho: 0.9, evap: 0.005, convThresh: 0.8, entropyThresh: 4.0, timeout: 5.0 } }
];

// Test function
async function runTests() {
  console.log('🧪 Starting Sudoku Solver Tests...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const [orderName, puzzles] of Object.entries(testPuzzles)) {
    const order = parseInt(orderName.replace('order', ''));
    console.log(`📊 Testing Order ${order} (${order * order}×${order * order}) puzzles:`);
    
    for (const [difficulty, puzzle] of Object.entries(puzzles)) {
      console.log(`  🎯 ${difficulty.toUpperCase()} puzzle:`);
      
      for (const algorithm of algorithms) {
        totalTests++;
        try {
          console.log(`    🔄 Testing ${algorithm.name}...`);
          
          const startTime = Date.now();
          const result = await solveSudoku(puzzle, algorithm.id, algorithm.params);
          const endTime = Date.now();
          
          if (result.success) {
            console.log(`    ✅ ${algorithm.name}: Solved in ${result.time?.toFixed(3)}s (${endTime - startTime}ms total)`);
            passedTests++;
          } else {
            console.log(`    ❌ ${algorithm.name}: Failed - ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.log(`    💥 ${algorithm.name}: Exception - ${error.message}`);
        }
      }
      console.log('');
    }
  }
  
  // Summary
  console.log('📈 Test Results Summary:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The solver is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
}

// Export for use in the app
export { runTests, testPuzzles, algorithms };

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - expose test function globally
  window.runSudokuTests = runTests;
  console.log('🧪 Sudoku solver tests loaded. Run window.runSudokuTests() to start testing.');
}

#!/usr/bin/env node
/**
 * Bulk Puzzle Instance Generator
 * 
 * Generates puzzle instances for 6x6 and 12x12 Sudoku grids with various fill percentages.
 * Uses the Multi-Colony DCM-ACO algorithm (Algorithm 2) for puzzle generation.
 * 
 * Usage:
 *   node scripts/generate-instances.js [options]
 *   npm run generate-instances [-- options]
 * 
 * Options:
 *   --sizes <sizes>              Comma-separated sizes (default: "6,12")
 *   --fill-percentages <percs>   Comma-separated percentages (default: "0,5,10,...,100")
 *   --count <num>                Instances per configuration (default: 100)
 *   --skip-existing              Skip if instances already exist
 *   --dry-run                    Show what would be generated without creating files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sizes: [6, 12],
    fillPercentages: Array.from({ length: 21 }, (_, i) => i * 5), // 0, 5, 10, ..., 100
    count: 100,
    skipExisting: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--sizes' && i + 1 < args.length) {
      options.sizes = args[++i].split(',').map(s => parseInt(s.trim()));
    } else if (arg === '--fill-percentages' && i + 1 < args.length) {
      options.fillPercentages = args[++i].split(',').map(p => parseInt(p.trim()));
    } else if (arg === '--count' && i + 1 < args.length) {
      options.count = parseInt(args[++i]);
    } else if (arg === '--skip-existing') {
      options.skipExisting = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Bulk Puzzle Instance Generator

Usage:
  node scripts/generate-instances.js [options]

Options:
  --sizes <sizes>              Comma-separated sizes (default: "6,12")
  --fill-percentages <percs>   Comma-separated percentages (default: "0,5,10,...,100")
  --count <num>                Instances per configuration (default: 100)
  --skip-existing              Skip if instances already exist
  --dry-run                    Show what would be generated without creating files
  --help, -h                   Show this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

// WASM module and utilities
let wasmModule = null;

async function initWasm() {
  if (!wasmModule) {
    try {
      // Import the WASM module using a file:// URL so Node ESM loader accepts it on Windows
      const wasmJsPath = path.join(__dirname, '../src/wasm/sudoku_solver.js');
      const wasmUrl = pathToFileURL(wasmJsPath).href;
      const wasmModuleFactory = await import(wasmUrl);
      wasmModule = await wasmModuleFactory.default();
      console.log('✓ WebAssembly module loaded successfully\n');
    } catch (error) {
      console.error('✗ Failed to load WebAssembly module:', error.message);
      throw error;
    }
  }
  return wasmModule;
}

async function solveSudoku(puzzleString, algorithm, params) {
  const module = await initWasm();
  
  try {
    const resultPtr = module.ccall(
      'solve_sudoku',
      'number',
      ['string', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [
        puzzleString,
        algorithm,
        params.nAnts || 4,
        params.numColonies || 3,
        params.numACS || 2,
        params.q0 || 0.9,
        params.rho || 0.9,
        params.evap || 0.005,
        params.convThresh || 0.8,
        params.entropyThresh || 4.0,
        params.timeout || 10.0
      ]
    );
    
    const resultString = module.UTF8ToString(resultPtr);
    module._free(resultPtr);
    
    return JSON.parse(resultString);
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error occurred during solving'
    };
  }
}

// Puzzle generation utilities
function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(''));
}

function gridToString(grid, size) {
  let result = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      result += (cell === '' || cell === null || cell === undefined) ? '.' : cell;
    }
  }
  return result;
}

function fisherYatesShuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function removeCellsRandomly(filledString, size, fillPercentage) {
  const totalCells = size * size;
  const cellsToKeep = Math.floor((totalCells * fillPercentage) / 100);
  const cellsToRemove = totalCells - cellsToKeep;
  
  const puzzleArray = filledString.split('');
  const cellIndices = Array.from({ length: totalCells }, (_, i) => i);
  const shuffledIndices = fisherYatesShuffle(cellIndices);
  const indicesToRemove = shuffledIndices.slice(0, cellsToRemove);
  
  indicesToRemove.forEach(index => {
    puzzleArray[index] = '.';
  });
  
  return puzzleArray.join('');
}

function gridToInstanceFormat(puzzleString, size) {
  let content = '';
  
  // Line 1: Size or order
  if (size === 6 || size === 12) {
    content += `${size}\n`;
  } else if (size === 9) {
    content += '3\n';
  } else if (size === 16) {
    content += '4\n';
  } else if (size === 25) {
    content += '5\n';
  }
  
  // Line 2: Unused integer
  content += '1\n';
  
  // Lines 3+: Grid data
  for (let i = 0; i < size; i++) {
    const rowValues = [];
    for (let j = 0; j < size; j++) {
      const index = i * size + j;
      const cell = puzzleString[index];
      
      if (cell === '.' || cell === '') {
        rowValues.push('-1');
      } else {
        // Convert character to 1-based value
        const charCode = cell.charCodeAt(0);
        let value;
        
        if (charCode >= 49 && charCode <= 57) { // '1'-'9'
          value = charCode - 48;
        } else if (charCode >= 65 && charCode <= 90) { // 'A'-'Z'
          value = charCode - 65 + 10;
        } else if (charCode >= 97 && charCode <= 122) { // 'a'-'z'
          value = charCode - 97 + 10;
        } else {
          value = -1;
        }
        
        rowValues.push(String(value));
      }
    }
    content += rowValues.join(' ') + '\n';
  }
  
  return content;
}

async function generateFilledBoard(size, algorithm, params) {
  const emptyGrid = createEmptyGrid(size);
  const emptyString = gridToString(emptyGrid, size);
  
  const result = await solveSudoku(emptyString, algorithm, params);
  
  if (!result.success || !result.solution) {
    throw new Error(`Failed to generate filled board: ${result.error || 'Unknown error'}`);
  }
  
  return result.solution;
}

async function generatePuzzle(size, algorithm, fillPercentage, params) {
  try {
    const filledString = await generateFilledBoard(size, algorithm, params);
    const puzzleString = removeCellsRandomly(filledString, size, fillPercentage);
    const instanceContent = gridToInstanceFormat(puzzleString, size);
    
    return {
      success: true,
      puzzleString,
      instanceContent,
      filledString,
      size,
      fillPercentage
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// File system utilities
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function loadIndex(indexPath) {
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading index.json:', error.message);
    return {};
  }
}

async function saveIndex(indexPath, indexData) {
  await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
}

// Main generation logic
async function generateInstances(options) {
  const startTime = Date.now();
  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0
  };

  console.log('='.repeat(70));
  console.log('Bulk Puzzle Instance Generator');
  console.log('='.repeat(70));
  console.log(`Sizes: ${options.sizes.join(', ')}`);
  console.log(`Fill percentages: ${options.fillPercentages.join(', ')}`);
  console.log(`Instances per configuration: ${options.count}`);
  console.log(`Skip existing: ${options.skipExisting}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log('='.repeat(70));
  console.log('');

  // Paths
  const instancesDir = path.join(__dirname, '../public/instances');
  const indexPath = path.join(instancesDir, 'index.json');

  // Load existing index
  let indexData = await loadIndex(indexPath);

  // Algorithm 2 (DCM-ACO) with default parameters
  const algorithm = 2;
  const params = {
    nAnts: 4,
    numColonies: 3,
    numACS: 2,
    q0: 0.9,
    rho: 0.9,
    evap: 0.005,
    convThresh: 0.8,
    entropyThresh: 4.0,
    timeout: 10.0
  };

  // Initialize WASM
  if (!options.dryRun) {
    await initWasm();
  }

  // Generate instances
  for (const size of options.sizes) {
    const category = `${size}x${size}`;
    const categoryDir = path.join(instancesDir, category);
    
    if (!options.dryRun) {
      await ensureDir(categoryDir);
    }
    
    // Initialize category in index if needed
    if (!indexData[category]) {
      indexData[category] = [];
    }

    console.log(`\nGenerating ${size}x${size} puzzles...`);
    console.log('-'.repeat(70));

    for (const fillPercent of options.fillPercentages) {
      console.log(`\n  Fill: ${fillPercent}%`);
      
      // For 0% fill, generate one empty puzzle and copy it
      if (fillPercent === 0) {
        const emptyPuzzleString = '.'.repeat(size * size);
        const instanceContent = gridToInstanceFormat(emptyPuzzleString, size);
        
        for (let i = 0; i < options.count; i++) {
          const filename = `inst${size}x${size}_${fillPercent}_${i}.txt`;
          const filePath = path.join(categoryDir, filename);
          
          stats.total++;
          
          // Check if already exists
          if (options.skipExisting && indexData[category].includes(filename)) {
            stats.skipped++;
            if (i % 10 === 0 || i === options.count - 1) {
              process.stdout.write(`\r    Progress: ${i + 1}/${options.count} (skipped: ${stats.skipped})`);
            }
            continue;
          }
          
          if (!options.dryRun) {
            try {
              await fs.writeFile(filePath, instanceContent, 'utf8');
              if (!indexData[category].includes(filename)) {
                indexData[category].push(filename);
              }
              stats.success++;
            } catch (error) {
              console.error(`\n    Error writing ${filename}:`, error.message);
              stats.failed++;
            }
          } else {
            stats.success++;
          }
          
          if (i % 10 === 0 || i === options.count - 1) {
            process.stdout.write(`\r    Progress: ${i + 1}/${options.count}`);
          }
        }
        console.log(' ✓');
        continue;
      }

      // For other fill percentages, generate unique puzzles
      for (let i = 0; i < options.count; i++) {
        const filename = `inst${size}x${size}_${fillPercent}_${i}.txt`;
        const filePath = path.join(categoryDir, filename);
        
        stats.total++;
        
        // Check if already exists
        if (options.skipExisting && indexData[category].includes(filename)) {
          stats.skipped++;
          if (i % 10 === 0 || i === options.count - 1) {
            process.stdout.write(`\r    Progress: ${i + 1}/${options.count} (skipped: ${stats.skipped})`);
          }
          continue;
        }
        
        if (!options.dryRun) {
          try {
            const result = await generatePuzzle(size, algorithm, fillPercent, params);
            
            if (!result.success) {
              throw new Error(result.error);
            }
            
            await fs.writeFile(filePath, result.instanceContent, 'utf8');
            
            if (!indexData[category].includes(filename)) {
              indexData[category].push(filename);
            }
            
            stats.success++;
          } catch (error) {
            console.error(`\n    Error generating ${filename}:`, error.message);
            stats.failed++;
          }
        } else {
          stats.success++;
        }
        
        if (i % 10 === 0 || i === options.count - 1) {
          process.stdout.write(`\r    Progress: ${i + 1}/${options.count}`);
        }
      }
      console.log(' ✓');
    }
  }

  // Save updated index
  if (!options.dryRun && stats.success > 0) {
    console.log('\nSaving index.json...');
    await saveIndex(indexPath, indexData);
    console.log('✓ Index saved');
  }

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(70));
  console.log('Summary');
  console.log('='.repeat(70));
  console.log(`Total: ${stats.total}`);
  console.log(`Success: ${stats.success}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Duration: ${duration}s`);
  console.log('='.repeat(70));
}

// Run
const options = parseArgs();
generateInstances(options).catch(error => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});


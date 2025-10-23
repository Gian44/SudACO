import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Script to copy instance files to client/public/instances/
// This ensures the instance files are available for the web app

const INSTANCES_SOURCE = '../../instances';
const INSTANCES_TARGET = '../public/instances';

console.log('Copying instance files...');

// Create target directory
if (!fs.existsSync(INSTANCES_TARGET)) {
  fs.mkdirSync(INSTANCES_TARGET, { recursive: true });
}

// Copy logic-solvable instances (all files)
const logicSolvableSource = path.join(INSTANCES_SOURCE, 'logic-solvable');
const logicSolvableTarget = path.join(INSTANCES_TARGET, 'logic-solvable');

if (!fs.existsSync(logicSolvableTarget)) {
  fs.mkdirSync(logicSolvableTarget, { recursive: true });
}

if (fs.existsSync(logicSolvableSource)) {
  const files = fs.readdirSync(logicSolvableSource);
  console.log(`Copying ${files.length} logic-solvable instances...`);
  
  files.forEach(file => {
    if (file.endsWith('.txt')) {
      const sourcePath = path.join(logicSolvableSource, file);
      const targetPath = path.join(logicSolvableTarget, file);
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
} else {
  console.warn('Warning: logic-solvable directory not found');
}

// Copy general instances (subset of files)
const generalSource = path.join(INSTANCES_SOURCE, 'general');
const generalTarget = path.join(INSTANCES_TARGET, 'general');

if (!fs.existsSync(generalTarget)) {
  fs.mkdirSync(generalTarget, { recursive: true });
}

if (fs.existsSync(generalSource)) {
  const files = fs.readdirSync(generalSource);
  
  // Filter and limit to a reasonable number for web deployment
  const txtFiles = files.filter(file => file.endsWith('.txt'));
  
  // Organize files by size and fill percentage to ensure we get representative samples
  const filesByCategory = {};
  txtFiles.forEach(file => {
    const match = file.match(/inst(\d+x\d+)_(\d+)_(\d+)\.txt/);
    if (match) {
      const size = match[1];
      const fillPercent = match[2];
      const key = `${size}_${fillPercent}`;
      
      if (!filesByCategory[key]) {
        filesByCategory[key] = [];
      }
      filesByCategory[key].push(file);
    }
  });
  
  // Take first 3 files from each category
  const filesToCopy = [];
  Object.keys(filesByCategory).forEach(key => {
    filesToCopy.push(...filesByCategory[key].slice(0, 3));
  });
  
  console.log(`Copying ${filesToCopy.length} general instances (out of ${txtFiles.length} available)...`);
  console.log(`  Categories: ${Object.keys(filesByCategory).length}`);
  
  filesToCopy.forEach(file => {
    const sourcePath = path.join(generalSource, file);
    const targetPath = path.join(generalTarget, file);
    fs.copyFileSync(sourcePath, targetPath);
  });
} else {
  console.warn('Warning: general directory not found');
}

// Generate index.json mapping categories to files
const index = {
  'logic-solvable': [],
  'general': {}
};

// Read logic-solvable files
if (fs.existsSync(logicSolvableTarget)) {
  const files = fs.readdirSync(logicSolvableTarget);
  index['logic-solvable'] = files.filter(file => file.endsWith('.txt')).sort();
}

// Read and organize general files by size and fill percentage
if (fs.existsSync(generalTarget)) {
  const files = fs.readdirSync(generalTarget).filter(file => file.endsWith('.txt'));
  
  files.forEach(file => {
    // Parse filename: inst{size}_{fill}_{number}.txt
    const match = file.match(/inst(\d+x\d+)_(\d+)_\d+\.txt/);
    if (match) {
      const size = match[1];
      const fillPercent = match[2];
      
      // Initialize size if not exists
      if (!index['general'][size]) {
        index['general'][size] = {};
      }
      
      // Initialize fill percentage if not exists
      if (!index['general'][size][fillPercent]) {
        index['general'][size][fillPercent] = [];
      }
      
      // Add file to the appropriate category
      index['general'][size][fillPercent].push(file);
    }
  });
  
  // Sort files within each category
  Object.keys(index['general']).forEach(size => {
    Object.keys(index['general'][size]).forEach(fillPercent => {
      index['general'][size][fillPercent].sort();
    });
  });
}

// Write index.json
const indexPath = path.join(INSTANCES_TARGET, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

console.log('✓ Instance files copied successfully!');
console.log(`  Logic-solvable: ${index['logic-solvable'].length} files`);
let generalCount = 0;
Object.keys(index['general']).forEach(size => {
  Object.keys(index['general'][size]).forEach(fillPercent => {
    generalCount += index['general'][size][fillPercent].length;
  });
});
console.log(`  General: ${generalCount} files`);
console.log(`  Index file: ${indexPath}`);

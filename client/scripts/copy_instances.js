import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Script to copy instance files to client/public/instances/
// This ensures the instance files are available for the web app

const INSTANCES_SOURCE = '../instances';
const INSTANCES_TARGET = './public/instances';

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
  
  // Take first 50 files to keep deployment size reasonable
  const filesToCopy = txtFiles.slice(0, 50);
  
  console.log(`Copying ${filesToCopy.length} general instances (out of ${txtFiles.length} available)...`);
  
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
  'general': []
};

// Read logic-solvable files
if (fs.existsSync(logicSolvableTarget)) {
  const files = fs.readdirSync(logicSolvableTarget);
  index['logic-solvable'] = files.filter(file => file.endsWith('.txt')).sort();
}

// Read general files
if (fs.existsSync(generalTarget)) {
  const files = fs.readdirSync(generalTarget);
  index['general'] = files.filter(file => file.endsWith('.txt')).sort();
}

// Write index.json
const indexPath = path.join(INSTANCES_TARGET, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

console.log('✓ Instance files copied successfully!');
console.log(`  Logic-solvable: ${index['logic-solvable'].length} files`);
console.log(`  General: ${index['general'].length} files`);
console.log(`  Index file: ${indexPath}`);

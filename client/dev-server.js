// Development server for file operations (same as production Vercel functions)
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Paths
const INSTANCES_DIR = path.join(__dirname, 'public', 'instances');
const INDEX_FILE = path.join(INSTANCES_DIR, 'index.json');

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Load index.json
 */
async function loadIndex() {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading index.json:', error);
    return {};
  }
}

/**
 * Save index.json
 */
async function saveIndex(indexData) {
  try {
    await fs.writeFile(INDEX_FILE, JSON.stringify(indexData, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving index.json:', error);
    return false;
  }
}

/**
 * Get next puzzle number
 */
function getNextPuzzleNumber(indexData, category, size, fillPercent) {
  const pattern = `inst${size}x${size}_${fillPercent}_`;
  let existingNumbers = [];
  
  if (category === 'general') {
    const sizeKey = `${size}x${size}`;
    const percentKey = String(fillPercent);
    
    if (indexData.general && indexData.general[sizeKey] && indexData.general[sizeKey][percentKey]) {
      const files = indexData.general[sizeKey][percentKey];
      existingNumbers = files
        .filter(file => file.startsWith(pattern))
        .map(file => {
          const match = file.match(new RegExp(pattern + '(\\d+)\\.txt'));
          return match ? parseInt(match[1]) : -1;
        })
        .filter(num => num >= 0);
    }
  } else {
    if (indexData[category] && Array.isArray(indexData[category])) {
      const files = indexData[category];
      existingNumbers = files
        .filter(file => file.startsWith(pattern))
        .map(file => {
          const match = file.match(new RegExp(pattern + '(\\d+)\\.txt'));
          return match ? parseInt(match[1]) : -1;
        })
        .filter(num => num >= 0);
    }
  }
  
  return existingNumbers.length === 0 ? 0 : Math.max(...existingNumbers) + 1;
}

/**
 * API Routes
 */

// Save generated puzzle
app.post('/api/save-puzzle', async (req, res) => {
  try {
    const { category, size, fillPercent, content, puzzleString } = req.body;
    
    if (!category || !size || fillPercent === undefined || fillPercent === null || !content || !puzzleString) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Load current index
    const indexData = await loadIndex();
    
    // Get next puzzle number
    const nextNumber = getNextPuzzleNumber(indexData, category, size, fillPercent);
    
    // Generate filename
    const filename = `inst${size}x${size}_${fillPercent}_${nextNumber}.txt`;
    
    // Determine file path
    let filePath;
    if (category === 'general') {
      const generalDir = path.join(INSTANCES_DIR, 'general');
      await ensureDir(generalDir);
      filePath = path.join(generalDir, filename);
    } else {
      const categoryDir = path.join(INSTANCES_DIR, category);
      await ensureDir(categoryDir);
      filePath = path.join(categoryDir, filename);
    }
    
    // Save puzzle file
    await fs.writeFile(filePath, content, 'utf8');
    
    // Update index.json
    if (category === 'general') {
      const sizeKey = `${size}x${size}`;
      const percentKey = String(fillPercent);
      
      if (!indexData.general) indexData.general = {};
      if (!indexData.general[sizeKey]) indexData.general[sizeKey] = {};
      if (!indexData.general[sizeKey][percentKey]) indexData.general[sizeKey][percentKey] = [];
      
      indexData.general[sizeKey][percentKey].push(filename);
    } else {
      if (!indexData[category]) indexData[category] = [];
      indexData[category].push(filename);
    }
    
    // Save updated index
    const saved = await saveIndex(indexData);
    
    if (!saved) {
      throw new Error('Failed to update index.json');
    }
    
    res.json({
      success: true,
      filename,
      filePath: filePath.replace(process.cwd(), ''),
      puzzleString
    });
    
  } catch (error) {
    console.error('Error saving puzzle:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all puzzles (including generated ones)
app.get('/api/puzzles', async (req, res) => {
  try {
    const indexData = await loadIndex();
    res.json(indexData);
  } catch (error) {
    console.error('Error loading puzzles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    platform: 'development'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Development API server running on http://localhost:${PORT}`);
  console.log(`Instances directory: ${INSTANCES_DIR}`);
});

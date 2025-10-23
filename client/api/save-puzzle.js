// Vercel API route: /api/save-puzzle
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, size, fillPercent, content, puzzleString } = req.body;
    
    if (!category || !size || fillPercent === undefined || fillPercent === null || !content || !puzzleString) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get next puzzle number
    const nextNumber = await getNextPuzzleNumber(category, size, fillPercent);
    
    // Generate filename
    const filename = `inst${size}x${size}_${fillPercent}_${nextNumber}.txt`;
    
    // Determine file path
    let filePath;
    if (category === 'general') {
      const generalDir = path.join(process.cwd(), 'public', 'instances', 'general');
      await ensureDir(generalDir);
      filePath = path.join(generalDir, filename);
    } else {
      const categoryDir = path.join(process.cwd(), 'public', 'instances', category);
      await ensureDir(categoryDir);
      filePath = path.join(categoryDir, filename);
    }
    
    // Save puzzle file
    await fs.writeFile(filePath, content, 'utf8');
    
    // Update index.json
    await updateIndexJson(category, size, fillPercent, filename);
    
    res.json({
      success: true,
      filename,
      puzzleString
    });
    
  } catch (error) {
    console.error('Error saving puzzle:', error);
    res.status(500).json({ error: error.message });
  }
}

async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

async function getNextPuzzleNumber(category, size, fillPercent) {
  const indexPath = path.join(process.cwd(), 'public', 'instances', 'index.json');
  
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    const indexData = JSON.parse(data);
    
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
  } catch (error) {
    console.error('Error reading index:', error);
    return 0;
  }
}

async function updateIndexJson(category, size, fillPercent, filename) {
  const indexPath = path.join(process.cwd(), 'public', 'instances', 'index.json');
  
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    const indexData = JSON.parse(data);
    
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
    
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  } catch (error) {
    console.error('Error updating index:', error);
    throw error;
  }
}

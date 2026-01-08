// Vercel API route: /api/puzzles/load
// Load a specific puzzle file
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, file } = req.query;
    
    if (!category || !file) {
      return res.status(400).json({ error: 'Category and file parameters required' });
    }

    // Sanitize inputs to prevent path traversal
    const safeCategory = category.replace(/[^a-zA-Z0-9-_]/g, '');
    const safeFile = file.replace(/[^a-zA-Z0-9-_.]/g, '');

    // Try to load from different possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'instances', safeCategory, safeFile),
      path.join(process.cwd(), 'instances', safeCategory, safeFile),
      path.join(process.cwd(), 'client', 'public', 'instances', safeCategory, safeFile),
      path.join(process.cwd(), '.vercel', 'output', 'static', 'instances', safeCategory, safeFile),
    ];

    let fileContent = null;
    let lastError = null;

    for (const filePath of possiblePaths) {
      try {
        fileContent = await fs.readFile(filePath, 'utf8');
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!fileContent) {
      // In production, puzzle files might not be available
      // Return a helpful error message
      return res.status(404).json({ 
        error: 'Puzzle file not found',
        message: 'This puzzle is not available in the current deployment. Please use the Daily puzzle or Upload your own puzzle file.',
        category: safeCategory,
        file: safeFile
      });
    }

    // Return the file content as text
    res.setHeader('Content-Type', 'text/plain');
    res.send(fileContent);

  } catch (error) {
    console.error('Error loading puzzle file:', error);
    res.status(500).json({ error: error.message });
  }
}

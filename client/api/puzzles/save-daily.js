// Vercel API route: /api/puzzles/save-daily
// Note: In Vercel, the filesystem is read-only, so this will fail gracefully
// Daily puzzles are stored in localStorage as a fallback
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
    const { filename, content, size, difficulty } = req.body;
    
    if (!filename || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Try multiple possible paths for the instances directory
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'instances', 'daily-puzzles'),
      path.join(process.cwd(), 'instances', 'daily-puzzles'),
      path.join(process.cwd(), 'client', 'public', 'instances', 'daily-puzzles'),
    ];

    let saved = false;
    let lastError = null;

    for (const dailyDir of possiblePaths) {
      try {
        // Ensure directory exists
        await fs.mkdir(dailyDir, { recursive: true });
        
        // Save puzzle file
        const filePath = path.join(dailyDir, filename);
        await fs.writeFile(filePath, content, 'utf8');
        
        // Update index.json
        await updateIndexJson(filename);
        
        saved = true;
        console.log(`Daily puzzle saved: ${filename}`);
        
        res.json({
          success: true,
          filename,
          filePath: filePath.replace(process.cwd(), ''),
          note: 'Saved successfully (development mode only)'
        });
        return;
      } catch (err) {
        lastError = err;
        // Try next path
        continue;
      }
    }

    // If all paths failed (e.g., in Vercel with read-only filesystem)
    // Return a success response but note that it's stored in localStorage only
    console.warn('Could not save daily puzzle to filesystem (read-only in Vercel):', lastError);
    res.json({
      success: true,
      filename,
      note: 'Filesystem is read-only. Puzzle stored in browser localStorage only.',
      localStorageOnly: true
    });

  } catch (error) {
    console.error('Error saving daily puzzle:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateIndexJson(filename) {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'instances', 'index.json'),
    path.join(process.cwd(), 'instances', 'index.json'),
    path.join(process.cwd(), 'client', 'public', 'instances', 'index.json'),
  ];

  for (const indexPath of possiblePaths) {
    try {
      const data = await fs.readFile(indexPath, 'utf8');
      const indexData = JSON.parse(data);
      
      if (!indexData['daily-puzzles']) {
        indexData['daily-puzzles'] = [];
      }
      
      // Add to index if not already there
      if (!indexData['daily-puzzles'].includes(filename)) {
        indexData['daily-puzzles'].push(filename);
        await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
      }
      
      return;
    } catch (err) {
      // Try next path
      continue;
    }
  }
  
  throw new Error('Could not update index.json');
}

// Vercel API route: /api/puzzles/save-daily
// Uses Vercel KV (Redis) for storage since filesystem is read-only
import { kv } from '@vercel/kv';
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
    const { filename, content, size, difficulty, puzzleString, date } = req.body;
    
    if (!filename || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Try to save to Vercel KV first (production)
    try {
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const puzzleDate = date || new Date().toISOString().split('T')[0];
        const puzzleKey = `daily-puzzle:${puzzleDate}`;
        
        // Check if puzzle for this date already exists - prevent duplicates
        const existingPuzzle = await kv.get(puzzleKey);
        if (existingPuzzle) {
          console.log(`Daily puzzle for ${puzzleDate} already exists, skipping save`);
          const parsed = typeof existingPuzzle === 'string' ? JSON.parse(existingPuzzle) : existingPuzzle;
          res.json({
            success: true,
            filename: parsed.filename || filename,
            storage: 'vercel-kv',
            note: 'Daily puzzle already exists for this date',
            alreadyExists: true,
            // Return the existing puzzle data so client can use it
            puzzleData: parsed
          });
          return;
        }
        
        // Save puzzle data to KV
        const puzzleData = {
          filename,
          content,
          size,
          difficulty,
          puzzleString,
          date: puzzleDate,
          createdAt: new Date().toISOString()
        };
        
        await kv.set(puzzleKey, JSON.stringify(puzzleData));
        
        // Add to daily puzzles list (with deduplication)
        const listKey = 'daily-puzzles:list';
        const existingList = await kv.get(listKey) || [];
        
        // Check if filename already exists in the list
        const filenameExists = existingList.includes(filename);
        
        if (!filenameExists) {
          // Deduplicate the list before adding (cleanup any existing duplicates)
          const uniqueList = [...new Set(existingList)];
          uniqueList.push(filename);
          await kv.set(listKey, uniqueList);
        }
        
        console.log(`Daily puzzle saved to KV: ${filename}`);
        
        res.json({
          success: true,
          filename,
          storage: 'vercel-kv',
          note: 'Saved to Vercel KV database'
        });
        return;
      }
    } catch (kvError) {
      console.warn('KV not available, trying filesystem:', kvError.message);
    }

    // Fallback: Try filesystem (development mode)
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'instances', 'daily-puzzles'),
      path.join(process.cwd(), 'instances', 'daily-puzzles'),
      path.join(process.cwd(), 'client', 'public', 'instances', 'daily-puzzles'),
    ];

    let saved = false;
    let lastError = null;

    for (const dailyDir of possiblePaths) {
      try {
        await fs.mkdir(dailyDir, { recursive: true });
        const filePath = path.join(dailyDir, filename);
        await fs.writeFile(filePath, content, 'utf8');
        await updateIndexJson(filename);
        
        saved = true;
        console.log(`Daily puzzle saved to filesystem: ${filename}`);
        
        res.json({
          success: true,
          filename,
          filePath: filePath.replace(process.cwd(), ''),
          storage: 'filesystem',
          note: 'Saved to filesystem (development mode)'
        });
        return;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    // If both KV and filesystem failed
    console.warn('Could not save daily puzzle to KV or filesystem:', lastError);
    res.json({
      success: true,
      filename,
      storage: 'localStorage',
      note: 'Could not save to server. Puzzle stored in browser localStorage only.',
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

// Vercel API route: /api/puzzles
import { kv } from '@vercel/kv';
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
    // Try to load from Vercel KV first (for daily puzzles)
    let indexData = null;
    
    try {
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        // Get daily puzzles from KV
        const listKey = 'daily-puzzles:list';
        const dailyPuzzleFiles = await kv.get(listKey) || [];
        
        // Load static index.json
        const possiblePaths = [
          path.join(process.cwd(), 'public', 'instances', 'index.json'),
          path.join(process.cwd(), 'instances', 'index.json'),
          path.join(process.cwd(), 'client', 'public', 'instances', 'index.json'),
          path.join(process.cwd(), '.vercel', 'output', 'static', 'instances', 'index.json'),
        ];

        for (const indexPath of possiblePaths) {
          try {
            const data = await fs.readFile(indexPath, 'utf8');
            indexData = JSON.parse(data);
            break;
          } catch (err) {
            continue;
          }
        }

        // Merge daily puzzles from KV into index
        if (indexData && dailyPuzzleFiles.length > 0) {
          if (!indexData['daily-puzzles']) {
            indexData['daily-puzzles'] = [];
          }
          // Add KV puzzles that aren't already in the index
          for (const filename of dailyPuzzleFiles) {
            if (!indexData['daily-puzzles'].includes(filename)) {
              indexData['daily-puzzles'].push(filename);
            }
          }
        }
      }
    } catch (kvError) {
      console.warn('KV not available, using filesystem only:', kvError.message);
    }

    // If KV didn't work or didn't have data, try filesystem only
    if (!indexData) {
      const possiblePaths = [
        path.join(process.cwd(), 'public', 'instances', 'index.json'),
        path.join(process.cwd(), 'instances', 'index.json'),
        path.join(process.cwd(), 'client', 'public', 'instances', 'index.json'),
        path.join(process.cwd(), '.vercel', 'output', 'static', 'instances', 'index.json'),
      ];

      let lastError = null;
      for (const indexPath of possiblePaths) {
        try {
          const data = await fs.readFile(indexPath, 'utf8');
          indexData = JSON.parse(data);
          break;
        } catch (err) {
          lastError = err;
          continue;
        }
      }

      if (!indexData) {
        console.error('Error loading puzzles from all file paths:', lastError);
        throw new Error(`Failed to load puzzle index from filesystem: ${lastError?.message || 'File not found'}`);
      }
    }
    
    res.json(indexData);
  } catch (error) {
    console.error('Error loading puzzles:', error);
    res.status(500).json({ error: error.message });
  }
}

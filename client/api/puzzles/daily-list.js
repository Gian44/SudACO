// Vercel API route: /api/puzzles/daily-list
// Get list of all daily puzzles from KV
import { kv } from '@vercel/kv';

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
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.json([]); // Return empty array if KV not configured
    }

    // Get list of daily puzzle filenames
    const listKey = 'daily-puzzles:list';
    const filenames = await kv.get(listKey) || [];
    
    // Parse dates from filenames and get puzzle metadata
    const puzzles = [];
    
    for (const filename of filenames) {
      try {
        // Extract date from filename (format: MMDDYYYY_size_difficulty.txt)
        // e.g., "01082026_12x12_hard.txt" -> date: "2026-01-08"
        const match = filename.match(/^(\d{2})(\d{2})(\d{4})_/);
        if (match) {
          const [, month, day, year] = match;
          const dateISO = `${year}-${month}-${day}`;
          
          // Try to get puzzle data from KV
          const puzzleKey = `daily-puzzle:${dateISO}`;
          const puzzleData = await kv.get(puzzleKey);
          
          if (puzzleData) {
            const parsed = typeof puzzleData === 'string' ? JSON.parse(puzzleData) : puzzleData;
            puzzles.push({
              date: dateISO,
              dateDisplay: new Date(dateISO).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              }),
              filename: parsed.filename || filename,
              size: parsed.size,
              difficulty: parsed.difficulty,
              createdAt: parsed.createdAt
            });
          } else {
            // If puzzle data not found, still include it with basic info from filename
            const sizeMatch = filename.match(/_(\d+x\d+)_/);
            const diffMatch = filename.match(/_([a-z]+)\.txt$/);
            puzzles.push({
              date: dateISO,
              dateDisplay: new Date(dateISO).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              }),
              filename,
              size: sizeMatch ? sizeMatch[1] : '9x9',
              difficulty: diffMatch ? diffMatch[1] : 'medium',
              createdAt: null
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to parse puzzle ${filename}:`, err);
        continue;
      }
    }
    
    // Sort by date (newest first)
    puzzles.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(puzzles);
  } catch (error) {
    console.error('Error loading daily puzzle list:', error);
    res.status(500).json({ error: error.message });
  }
}

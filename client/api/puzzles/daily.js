// Vercel API route: /api/puzzles/daily
// Get daily puzzle for a specific date from KV or generate on-demand
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
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }

    // Try to get from KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const puzzleKey = `daily-puzzle:${date}`;
      const puzzleData = await kv.get(puzzleKey);
      
      if (puzzleData) {
        const parsed = typeof puzzleData === 'string' ? JSON.parse(puzzleData) : puzzleData;
        return res.json(parsed);
      }
    }

    // Not found in KV
    res.status(404).json({ 
      error: 'Daily puzzle not found',
      note: 'Puzzle can be generated on-demand on the client side'
    });

  } catch (error) {
    console.error('Error loading daily puzzle:', error);
    res.status(500).json({ error: error.message });
  }
}

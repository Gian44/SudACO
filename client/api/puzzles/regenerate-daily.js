// Vercel API route: /api/puzzles/regenerate-daily
// Regenerate a daily puzzle for a specific date (forces new generation)
import { kv } from '@vercel/kv';

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
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(503).json({ error: 'KV not configured' });
    }

    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date (YYYY-MM-DD) required' });
    }

    // Delete existing puzzle for this date
    const puzzleKey = `daily-puzzle:${date}`;
    await kv.del(puzzleKey);
    
    // Remove all filenames for this date from list
    const listKey = 'daily-puzzles:list';
    const existingList = await kv.get(listKey) || [];
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      const dateStr = `${month}${day}${year}`; // MMDDYYYY format
      const updatedList = existingList.filter(f => !f.startsWith(dateStr));
      await kv.set(listKey, updatedList);
    }

    res.json({
      success: true,
      message: `Puzzle for ${date} deleted. It will be regenerated on next access.`,
      date
    });

  } catch (error) {
    console.error('Error regenerating daily puzzle:', error);
    res.status(500).json({ error: error.message });
  }
}

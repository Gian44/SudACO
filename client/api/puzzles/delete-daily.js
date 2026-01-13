// Vercel API route: /api/puzzles/delete-daily
// Delete a daily puzzle from KV by date or filename
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(503).json({ error: 'KV not configured' });
    }

    const { date, filename } = req.method === 'POST' ? req.body : { date: req.query.date, filename: req.query.filename };

    if (!date && !filename) {
      return res.status(400).json({ error: 'Date (YYYY-MM-DD) or filename required' });
    }

    let puzzleDate = date;
    let targetFilename = filename;

    // If filename provided, extract date from it
    if (filename && !date) {
      const match = filename.match(/^(\d{2})(\d{2})(\d{4})_/);
      if (match) {
        const [, month, day, year] = match;
        puzzleDate = `${year}-${month}-${day}`;
        targetFilename = filename;
      } else {
        return res.status(400).json({ error: 'Invalid filename format' });
      }
    }

    // If date provided, get the puzzle to find its filename
    if (date && !filename) {
      const puzzleKey = `daily-puzzle:${puzzleDate}`;
      const puzzleData = await kv.get(puzzleKey);
      if (puzzleData) {
        const parsed = typeof puzzleData === 'string' ? JSON.parse(puzzleData) : puzzleData;
        targetFilename = parsed.filename;
      }
    }

    const deleted = [];

    // Delete puzzle from KV by date
    if (puzzleDate) {
      const puzzleKey = `daily-puzzle:${puzzleDate}`;
      const existing = await kv.get(puzzleKey);
      if (existing) {
        await kv.del(puzzleKey);
        deleted.push(`Puzzle data for ${puzzleDate}`);
      }
    }

    // Remove filename from list
    const listKey = 'daily-puzzles:list';
    const existingList = await kv.get(listKey) || [];
    
    if (targetFilename && existingList.includes(targetFilename)) {
      const updatedList = existingList.filter(f => f !== targetFilename);
      await kv.set(listKey, updatedList);
      deleted.push(`Filename ${targetFilename} from list`);
    }

    // Also remove any other filenames for the same date
    if (puzzleDate) {
      const match = puzzleDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, year, month, day] = match;
        const dateStr = `${month}${day}${year}`; // MMDDYYYY format
        const updatedList = (await kv.get(listKey) || []).filter(f => !f.startsWith(dateStr));
        await kv.set(listKey, updatedList);
        if (updatedList.length < existingList.length) {
          deleted.push(`All filenames for date ${puzzleDate} from list`);
        }
      }
    }

    if (deleted.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Puzzle not found',
        date: puzzleDate,
        filename: targetFilename
      });
    }

    res.json({
      success: true,
      message: 'Puzzle deleted successfully',
      deleted,
      date: puzzleDate,
      filename: targetFilename
    });

  } catch (error) {
    console.error('Error deleting daily puzzle:', error);
    res.status(500).json({ error: error.message });
  }
}

// Ensure a daily puzzle exists for a given date (generate and save if missing)
import { kv } from '@vercel/kv';
import { generatePuzzleForDate, getRandomSizeAndDifficulty } from '../cron/generate-daily.js';

export default async function handler(req, res) {
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

    const dateISO = (req.body?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: 'Body must include date (YYYY-MM-DD)' });
    }

    const puzzleKey = `daily-puzzle:${dateISO}`;
    const existing = await kv.get(puzzleKey);
    if (existing) {
      const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
      return res.json({
        success: true,
        message: `Puzzle for ${dateISO} already exists`,
        date: dateISO,
        size: parsed.size,
        difficulty: parsed.difficulty,
        created: false
      });
    }

    const date = new Date(dateISO + 'T12:00:00.000Z');
    const { size, difficulty } = getRandomSizeAndDifficulty(date);
    const puzzleData = await generatePuzzleForDate(dateISO, size, difficulty);

    const toSave = {
      filename: puzzleData.filename,
      content: puzzleData.content,
      size: puzzleData.size,
      difficulty: puzzleData.difficulty,
      puzzleString: puzzleData.puzzleString,
      date: dateISO,
      createdAt: new Date().toISOString()
    };

    await kv.set(puzzleKey, JSON.stringify(toSave));

    const listKey = 'daily-puzzles:list';
    let list = (await kv.get(listKey)) || [];
    if (!list.includes(puzzleData.filename)) {
      list.push(puzzleData.filename);
      await kv.set(listKey, list);
    }

    res.json({
      success: true,
      message: `Puzzle for ${dateISO} created`,
      date: dateISO,
      size: puzzleData.size,
      difficulty: puzzleData.difficulty,
      filename: puzzleData.filename,
      created: true
    });
  } catch (error) {
    console.error('Error ensuring daily puzzle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

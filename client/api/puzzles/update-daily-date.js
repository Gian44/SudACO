// Vercel API route: /api/puzzles/update-daily-date
// Move an existing daily puzzle from one date to another in KV (change its date)
import { kv } from '@vercel/kv';

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

    const { fromDate, toDate } = req.body || {};

    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: 'Missing fromDate or toDate. Send JSON: { "fromDate": "YYYY-MM-DD", "toDate": "YYYY-MM-DD" }'
      });
    }

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(fromDate) || !dateRe.test(toDate)) {
      return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
    }

    if (fromDate === toDate) {
      return res.status(400).json({ error: 'fromDate and toDate must be different' });
    }

    const fromKey = `daily-puzzle:${fromDate}`;
    const toKey = `daily-puzzle:${toDate}`;

    const existing = await kv.get(fromKey);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `No puzzle found for date ${fromDate}`,
        fromDate
      });
    }

    const existingTarget = await kv.get(toKey);
    if (existingTarget) {
      return res.status(409).json({
        success: false,
        error: `A puzzle already exists for ${toDate}. Delete it first or choose another toDate.`,
        toDate
      });
    }

    const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;

    // Build new filename for toDate (MMDDYYYY_size_difficulty.txt)
    const [y, m, d] = toDate.split('-');
    const dateStr = `${m}${d}${y}`;
    const size = parsed.size || 9;
    const difficulty = parsed.difficulty || 'medium';
    const newFilename = `${dateStr}_${size}x${size}_${difficulty}.txt`;

    const puzzleData = {
      filename: newFilename,
      content: parsed.content,
      size: parsed.size,
      difficulty: parsed.difficulty,
      puzzleString: parsed.puzzleString,
      date: toDate,
      createdAt: parsed.createdAt || new Date().toISOString()
    };

    await kv.set(toKey, JSON.stringify(puzzleData));

    const listKey = 'daily-puzzles:list';
    let list = (await kv.get(listKey)) || [];

    const oldFilename = parsed.filename;
    if (oldFilename && list.includes(oldFilename)) {
      list = list.filter(f => f !== oldFilename);
    }
    if (!list.includes(newFilename)) {
      list.push(newFilename);
    }
    await kv.set(listKey, list);

    await kv.del(fromKey);

    res.json({
      success: true,
      message: `Puzzle moved from ${fromDate} to ${toDate}`,
      fromDate,
      toDate,
      oldFilename: oldFilename || null,
      newFilename
    });
  } catch (error) {
    console.error('Error updating daily puzzle date:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

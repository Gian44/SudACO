// Single admin API to stay under Vercel Hobby 12-function limit.
// POST body.action: 'replace-size' | 'ensure' | 'update-date'
import { kv } from '@vercel/kv';
import { generatePuzzleForDate, getRandomSizeAndDifficulty } from '../cron/generate-daily.js';

const REPLACEMENT_SIZES = [9, 16, 25];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function nextDay(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

    const action = req.body?.action || 'replace-size';

    if (action === 'replace-size') {
      const fromDate = (req.body?.fromDate || '2026-01-10').slice(0, 10);
      const toDate = (req.body?.toDate || '2026-02-19').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        return res.status(400).json({ error: 'fromDate and toDate must be YYYY-MM-DD' });
      }
      if (fromDate > toDate) {
        return res.status(400).json({ error: 'fromDate must be <= toDate' });
      }
      const replaced = [];
      for (let dateISO = fromDate; dateISO <= toDate; dateISO = nextDay(dateISO)) {
        const puzzleKey = `daily-puzzle:${dateISO}`;
        const raw = await kv.get(puzzleKey);
        if (!raw) continue;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const size = parseInt(parsed.size, 10) || parsed.size;
        if (size !== 6 && size !== 12) continue;
        const newSize = randomChoice(REPLACEMENT_SIZES);
        const newDifficulty = randomChoice(DIFFICULTIES);
        const puzzleData = await generatePuzzleForDate(dateISO, newSize, newDifficulty);
        const toSave = {
          filename: puzzleData.filename,
          content: puzzleData.content,
          size: puzzleData.size,
          difficulty: puzzleData.difficulty,
          puzzleString: puzzleData.puzzleString,
          date: dateISO,
          createdAt: parsed.createdAt || new Date().toISOString()
        };
        await kv.set(puzzleKey, JSON.stringify(toSave));
        let list = (await kv.get('daily-puzzles:list')) || [];
        if (parsed.filename && list.includes(parsed.filename)) list = list.filter(f => f !== parsed.filename);
        if (!list.includes(puzzleData.filename)) list.push(puzzleData.filename);
        await kv.set('daily-puzzles:list', list);
        replaced.push({ date: dateISO, oldSize: size, newSize: puzzleData.size, newDifficulty: puzzleData.difficulty, filename: puzzleData.filename });
      }
      return res.json({ success: true, message: `Replaced ${replaced.length} puzzle(s)`, fromDate, toDate, replaced });
    }

    if (action === 'ensure') {
      const dateISO = (req.body?.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
        return res.status(400).json({ error: 'Body must include date (YYYY-MM-DD)' });
      }
      const puzzleKey = `daily-puzzle:${dateISO}`;
      const existing = await kv.get(puzzleKey);
      if (existing) {
        const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
        return res.json({ success: true, message: `Puzzle for ${dateISO} already exists`, date: dateISO, size: parsed.size, difficulty: parsed.difficulty, created: false });
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
      let list = (await kv.get('daily-puzzles:list')) || [];
      if (!list.includes(puzzleData.filename)) list.push(puzzleData.filename);
      await kv.set('daily-puzzles:list', list);
      return res.json({ success: true, message: `Puzzle for ${dateISO} created`, date: dateISO, size: puzzleData.size, difficulty: puzzleData.difficulty, filename: puzzleData.filename, created: true });
    }

    if (action === 'update-date') {
      const fromDate = (req.body?.fromDate || '').slice(0, 10);
      const toDate = (req.body?.toDate || '').slice(0, 10);
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: 'Missing fromDate or toDate' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
      }
      if (fromDate === toDate) {
        return res.status(400).json({ error: 'fromDate and toDate must be different' });
      }
      const fromKey = `daily-puzzle:${fromDate}`;
      const toKey = `daily-puzzle:${toDate}`;
      const existing = await kv.get(fromKey);
      if (!existing) {
        return res.status(404).json({ success: false, error: `No puzzle found for date ${fromDate}`, fromDate });
      }
      const existingTarget = await kv.get(toKey);
      if (existingTarget) {
        return res.status(409).json({ success: false, error: `A puzzle already exists for ${toDate}`, toDate });
      }
      const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
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
      let list = (await kv.get('daily-puzzles:list')) || [];
      if (parsed.filename && list.includes(parsed.filename)) list = list.filter(f => f !== parsed.filename);
      if (!list.includes(newFilename)) list.push(newFilename);
      await kv.set('daily-puzzles:list', list);
      await kv.del(fromKey);
      return res.json({ success: true, message: `Puzzle moved from ${fromDate} to ${toDate}`, fromDate, toDate, newFilename });
    }

    return res.status(400).json({ error: 'Invalid action. Use action: "replace-size", "ensure", or "update-date"' });
  } catch (error) {
    console.error('Puzzles admin error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

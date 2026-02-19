// Replace 6x6 and 12x12 daily puzzles in a date range with random 9x9, 16x16, or 25x25
import { kv } from '@vercel/kv';
import { generatePuzzleForDate } from '../cron/generate-daily.js';

const REPLACEMENT_SIZES = [9, 16, 25];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function nextDay(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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

      const listKey = 'daily-puzzles:list';
      let list = (await kv.get(listKey)) || [];
      const oldFilename = parsed.filename;
      if (oldFilename && list.includes(oldFilename)) {
        list = list.filter(f => f !== oldFilename);
      }
      if (!list.includes(puzzleData.filename)) {
        list.push(puzzleData.filename);
      }
      await kv.set(listKey, list);

      replaced.push({
        date: dateISO,
        oldSize: size,
        newSize: puzzleData.size,
        newDifficulty: puzzleData.difficulty,
        filename: puzzleData.filename
      });
    }

    res.json({
      success: true,
      message: `Replaced ${replaced.length} puzzle(s) (6x6 or 12x12 → 9x9, 16x16, or 25x25)`,
      fromDate,
      toDate,
      replaced
    });
  } catch (error) {
    console.error('Error replacing daily puzzle sizes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

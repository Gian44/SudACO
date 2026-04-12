// Vercel API route: /api/puzzles/daily-list
// Get list of all daily puzzles from KV
import { kv } from '@vercel/kv';

function buildDateDisplay(year, month, day) {
  const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return utcDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

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
    const startedAt = Date.now();
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.json([]); // Return empty array if KV not configured
    }

    // Get list of daily puzzle filenames
    const listKey = 'daily-puzzles:list';
    const filenames = await kv.get(listKey) || [];
    
    // Deduplicate filenames (in case of race conditions during save)
    const uniqueFilenames = [...new Set(filenames)];
    
    // Parse all metadata directly from filenames.
    // Root-cause fix: avoid one KV read per filename, which caused endpoint timeouts.
    const puzzles = [];
    const seenDates = new Set(); // Track dates to avoid duplicates
    
    for (const filename of uniqueFilenames) {
      try {
        // Extract date from filename (format: MMDDYYYY_size_difficulty.txt)
        // e.g., "01082026_16x16_hard.txt" -> date: "2026-01-08"
        const match = filename.match(/^(\d{2})(\d{2})(\d{4})_/);
        if (match) {
          const [, month, day, year] = match;
          const dateISO = `${year}-${month}-${day}`;
          
          // Skip if we already have a puzzle for this date (prevents duplicates)
          if (seenDates.has(dateISO)) {
            console.log(`Skipping duplicate puzzle for date ${dateISO}: ${filename}`);
            continue;
          }
          seenDates.add(dateISO);

          const sizeMatch = filename.match(/_(\d+x\d+)_/);
          const diffMatch = filename.match(/_([a-z]+)\.txt$/i);
          puzzles.push({
            date: dateISO,
            dateDisplay: buildDateDisplay(year, month, day),
            filename,
            size: sizeMatch ? sizeMatch[1] : '9x9',
            difficulty: diffMatch ? diffMatch[1].toLowerCase() : 'medium',
            createdAt: null
          });
        }
      } catch (err) {
        console.warn(`Failed to parse puzzle ${filename}:`, err);
        continue;
      }
    }
    
    // Sort by date (newest first)
    puzzles.sort((a, b) => b.date.localeCompare(a.date));
    console.info(`[daily-list-api] served ${puzzles.length} items in ${Date.now() - startedAt}ms`);
    
    res.json(puzzles);
  } catch (error) {
    console.error('Error loading daily puzzle list:', error);
    res.status(500).json({ error: error.message });
  }
}

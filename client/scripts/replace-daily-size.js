// Replace 6x6 and 12x12 daily puzzles with 9x9, 16x16, or 25x25 in date range.
// Usage: node replace-daily-size.js [fromDate] [toDate]
// Example: node replace-daily-size.js 2026-01-10 2026-02-19
// Default: 2026-01-10 to 2026-02-19

import https from 'https';

const fromDate = process.argv[2] || '2026-01-10';
const toDate = process.argv[3] || '2026-02-19';

const url = new URL('https://sud-aco.vercel.app/api/puzzles/replace-daily-size');
const postData = JSON.stringify({ fromDate, toDate });

console.log(`Replacing 6x6 and 12x12 with 9x9/16x16/25x25 from ${fromDate} to ${toDate}...`);

const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('✓', result.message);
        if (result.replaced?.length) {
          result.replaced.forEach(r => console.log(`  ${r.date}: ${r.oldSize}x${r.oldSize} → ${r.newSize}x${r.newSize} ${r.newDifficulty}`));
        }
      } else {
        console.error('✗', result.error || 'Unknown error');
        process.exit(1);
      }
    } catch (e) {
      console.error('✗ Failed to parse response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('✗ Request failed:', e.message);
  process.exit(1);
});
req.write(postData);
req.end();

// Ensure a daily puzzle exists for a given date (create if missing).
// Usage: node ensure-daily.js <YYYY-MM-DD>
// Example: node ensure-daily.js 2026-01-15

import https from 'https';

const date = process.argv[2] || '2026-01-15';

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: node ensure-daily.js YYYY-MM-DD');
  process.exit(1);
}

const url = new URL('https://sud-aco.vercel.app/api/puzzles/admin');
const postData = JSON.stringify({ action: 'ensure', date });

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
        console.log('✓', result.message, result.created ? `(${result.size}x${result.size} ${result.difficulty})` : '');
      } else {
        console.error('✗', result.error || 'Unknown error');
        process.exit(1);
      }
    } catch (e) {
      console.error('✗ Response:', data);
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

// Script to delete a daily puzzle from Vercel KV
// Usage: node delete-daily-puzzle.js <date> [filename]
// Example: node delete-daily-puzzle.js 2026-01-14
// Example: node delete-daily-puzzle.js 2026-01-14 01142026_12x12_easy.txt

import https from 'https';

const date = process.argv[2];
const filename = process.argv[3];

if (!date) {
  console.error('Usage: node delete-daily-puzzle.js <date> [filename]');
  console.error('Example: node delete-daily-puzzle.js 2026-01-14');
  process.exit(1);
}

const url = new URL(filename 
  ? `https://sud-aco.vercel.app/api/puzzles/delete-daily?date=${encodeURIComponent(date)}&filename=${encodeURIComponent(filename)}`
  : `https://sud-aco.vercel.app/api/puzzles/delete-daily?date=${encodeURIComponent(date)}`);

console.log(`Deleting daily puzzle for date: ${date}${filename ? `, filename: ${filename}` : ''}`);
console.log(`URL: ${url.toString()}`);

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname + url.search,
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('✓ Success:', result.message);
        if (result.deleted && result.deleted.length > 0) {
          console.log('Deleted items:');
          result.deleted.forEach(item => console.log(`  - ${item}`));
        }
      } else {
        console.error('✗ Error:', result.error || 'Unknown error');
        process.exit(1);
      }
    } catch (error) {
      console.error('✗ Failed to parse response:', error.message);
      console.error('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('✗ Request failed:', error.message);
  process.exit(1);
});

req.end();

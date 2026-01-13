// Script to regenerate a daily puzzle from Vercel KV
// Usage: node regenerate-daily-puzzle.js <date>
// Example: node regenerate-daily-puzzle.js 2026-01-14

import https from 'https';

const date = process.argv[2];

if (!date) {
  console.error('Usage: node regenerate-daily-puzzle.js <date>');
  console.error('Example: node regenerate-daily-puzzle.js 2026-01-14');
  process.exit(1);
}

const url = new URL(`https://sud-aco.vercel.app/api/puzzles/regenerate-daily`);

console.log(`Regenerating daily puzzle for date: ${date}`);

const postData = JSON.stringify({ date });

const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
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
        console.log('The puzzle will be regenerated with a unique seed when accessed next.');
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

req.write(postData);
req.end();

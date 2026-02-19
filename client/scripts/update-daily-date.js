// Change the date of an existing daily puzzle in the deployed app (Vercel KV).
// Usage: node update-daily-date.js <fromDate> <toDate>
// Example: node update-daily-date.js 2026-02-20 2026-02-19
// (Moves the puzzle that was on Feb 20 to Feb 19; useful to fix timezone/off-by-one issues.)

import https from 'https';

const fromDate = process.argv[2];
const toDate = process.argv[3];

if (!fromDate || !toDate) {
  console.error('Usage: node update-daily-date.js <fromDate> <toDate>');
  console.error('Dates must be YYYY-MM-DD');
  console.error('Example: node update-daily-date.js 2026-02-20 2026-02-19');
  process.exit(1);
}

const url = new URL('https://sud-aco.vercel.app/api/puzzles/update-daily-date');
const postData = JSON.stringify({ fromDate, toDate });

console.log(`Moving daily puzzle from ${fromDate} to ${toDate}...`);

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

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('✓ Success:', result.message);
        console.log('  New filename:', result.newFilename);
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

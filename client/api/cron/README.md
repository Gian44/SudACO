# Cron Job: Daily Puzzle Generation

This cron job automatically generates tomorrow's daily puzzle at midnight UTC.

## WASM Files Required

For this cron job to work in Vercel, the WASM files must be accessible. You have two options:

### Option 1: Copy WASM files to api directory (Recommended)

Copy the WASM files to the api directory so they're included in the serverless function:

```bash
# From client directory
mkdir -p api/cron/wasm
cp src/wasm/sudoku_solver.js api/cron/wasm/
cp src/wasm/sudoku_solver.wasm api/cron/wasm/
```

Then update the import path in `generate-daily.js` to use `./wasm/sudoku_solver.js`.

### Option 2: Use build script

Create a build script that copies WASM files before deployment.

## Current Status

The cron job will:
- ✅ Generate tomorrow's puzzle at midnight UTC
- ✅ Save to Vercel KV (if configured)
- ⚠️ May fail if WASM files are not accessible in serverless environment

## Testing

Test the endpoint manually:
```bash
curl https://your-domain.vercel.app/api/cron/generate-daily
```

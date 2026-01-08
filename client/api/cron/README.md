# Cron Job: Daily Puzzle Generation

This cron job automatically generates tomorrow's daily puzzle at midnight UTC.

## WASM Files Required

**WASM files are located in `client/wasm/`** (moved from `api/cron/wasm/` to avoid Vercel path conflicts).

The cron job will automatically find the WASM files in:
- `client/wasm/sudoku_solver.js`
- `client/wasm/sudoku_solver.wasm`

These files are included in the deployment and accessible to the serverless function.

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

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

## Daily Puzzle Auto-Generation

The application includes automatic daily puzzle generation using Vercel Cron Jobs. The cron job runs daily at midnight UTC to pre-generate tomorrow's puzzle.

### Setup

1. **Cron Job Configuration**: Already configured in `vercel.json`
   - Path: `/api/cron/generate-daily`
   - Schedule: `0 0 * * *` (daily at midnight UTC)

2. **Environment Variables** (required for production):
   - `KV_REST_API_URL`: Vercel KV REST API URL (get from Vercel Dashboard → Storage → KV → Settings)
   - `KV_REST_API_TOKEN`: Vercel KV REST API token (get from Vercel Dashboard → Storage → KV → Settings)
   - `CRON_SECRET`: Secret token for securing the cron endpoint (optional, but recommended)
   
   See [SETUP.md](./SETUP.md) for detailed instructions on getting these values.

3. **WASM Files**: Ensure `sudoku_solver.js` and `sudoku_solver.wasm` are available in:
   - `client/src/wasm/` (for development)
   - `client/public/` (for production)

### How It Works

- The cron job generates tomorrow's puzzle automatically at midnight UTC
- Puzzles are saved to Vercel KV (production) or filesystem (development)
- Puzzles are deterministic - same date always generates the same puzzle
- If a puzzle already exists, the cron job skips generation

### Manual Testing

You can manually trigger the cron endpoint:
```bash
curl -X GET https://your-domain.vercel.app/api/cron/generate-daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or without authentication (if CRON_SECRET is not set):
```bash
curl -X GET https://your-domain.vercel.app/api/cron/generate-daily
```
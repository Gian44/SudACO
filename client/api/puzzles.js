// Vercel API route: /api/puzzles
import { promises as fs } from 'fs';
import path from 'path';

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
    // Try multiple possible paths for the index.json file
    // In Vercel, the public directory might be at different locations depending on build setup
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'instances', 'index.json'),
      path.join(process.cwd(), 'instances', 'index.json'),
      path.join(process.cwd(), 'client', 'public', 'instances', 'index.json'),
      path.join(process.cwd(), '.vercel', 'output', 'static', 'instances', 'index.json'),
    ];

    let indexData = null;
    let lastError = null;

    for (const indexPath of possiblePaths) {
      try {
        const data = await fs.readFile(indexPath, 'utf8');
        indexData = JSON.parse(data);
        break; // Success, exit loop
      } catch (err) {
        lastError = err;
        // Try next path
        continue;
      }
    }

    if (!indexData) {
      console.error('Error loading puzzles from all file paths:', lastError);
      throw new Error(`Failed to load puzzle index from filesystem: ${lastError?.message || 'File not found'}`);
    }
    
    res.json(indexData);
  } catch (error) {
    console.error('Error loading puzzles:', error);
    res.status(500).json({ error: error.message });
  }
}

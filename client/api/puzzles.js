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
    const indexPath = path.join(process.cwd(), 'public', 'instances', 'index.json');
    const data = await fs.readFile(indexPath, 'utf8');
    const indexData = JSON.parse(data);
    
    res.json(indexData);
  } catch (error) {
    console.error('Error loading puzzles:', error);
    res.status(500).json({ error: error.message });
  }
}

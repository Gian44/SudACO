// Ensure index.json is copied to dist after build
import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const src = join(__dirname, '..', 'public', 'instances', 'index.json');
const dest = join(__dirname, '..', 'dist', 'instances', 'index.json');

if (existsSync(src)) {
  try {
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    console.log('✓ Copied index.json to dist/instances/');
  } catch (error) {
    console.warn('Could not copy index.json:', error.message);
  }
} else {
  console.warn('index.json not found in public/instances/');
}

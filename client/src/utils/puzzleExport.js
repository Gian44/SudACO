import { savePuzzleFile } from './fileSystemManager';

export function buildPuzzleInstanceFileContent(gridData, size) {
  const firstLine = [9, 16, 25].includes(size) ? Math.sqrt(size) : size;
  const header = `${firstLine}\n1\n`;
  const body = gridData
    .map((row) => row.map((cell) => {
      if (cell === '' || cell == null) return -1;
      const num = Number(cell);
      return Number.isFinite(num) ? num : -1;
    }).join(' '))
    .join('\n');
  return `${header}${body}\n`;
}

export function downloadPuzzleTxt({ grid, size, typeLabel = 'puzzle' }) {
  const content = buildPuzzleInstanceFileContent(grid, size);
  const filename = `sudaco_${typeLabel}_${size}x${size}_${Date.now()}.txt`;
  savePuzzleFile(filename, content, 'exports');
}

export function buildPuzzleReportTextContent({
  initialGrid,
  targetGrid,
  size,
  targetLabel = 'Solved Sudoku Puzzle/Current Progress',
  algorithmName = 'Multi-Colony DCM-ACO'
}) {
  const generated = new Date().toLocaleString();
  const initialBlock = buildPuzzleInstanceFileContent(initialGrid, size).trimEnd();
  const targetBlock = buildPuzzleInstanceFileContent(targetGrid, size).trimEnd();
  return [
    'SudACO - Puzzle Report',
    `Generated: ${generated}`,
    `Size: ${size}x${size}`,
    `Algorithm: ${algorithmName}`,
    '',
    'Initial Grid',
    initialBlock,
    '',
    targetLabel,
    targetBlock,
    ''
  ].join('\n');
}

export function downloadPuzzleReportTxt({
  initialGrid,
  targetGrid,
  size,
  targetLabel,
  algorithmName
}) {
  const content = buildPuzzleReportTextContent({
    initialGrid,
    targetGrid,
    size,
    targetLabel,
    algorithmName
  });
  const filename = `sudaco_report_${size}x${size}_${Date.now()}.txt`;
  savePuzzleFile(filename, content, 'exports');
}

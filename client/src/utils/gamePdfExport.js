import { jsPDF } from 'jspdf';

function drawGrid(doc, grid, x, y, width, title) {
  const size = grid.length;
  const cell = width / size;
  doc.setFontSize(12);
  doc.text(title, x, y - 6);

  doc.setLineWidth(0.1);
  for (let i = 0; i <= size; i += 1) {
    const px = x + i * cell;
    const py = y + i * cell;
    doc.line(px, y, px, y + width);
    doc.line(x, py, x + width, py);
  }

  doc.setFontSize(Math.max(5, 12 - Math.floor(size / 3)));
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const value = grid[r][c] || '';
      if (!value) continue;
      const tx = x + c * cell + cell / 2;
      const ty = y + r * cell + cell / 2 + 1.5;
      doc.text(String(value), tx, ty, { align: 'center' });
    }
  }
}

export function downloadSolvedPuzzlePdf({
  originalGrid,
  solvedGrid,
  size,
  difficulty,
  algorithmName,
  params
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SudACO - Solved Puzzle Report', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  doc.text(`Size: ${size}x${size}`, 14, 28);
  doc.text(`Difficulty: ${difficulty || 'unknown'}`, 14, 33);
  doc.text(`Algorithm: ${algorithmName}`, 14, 38);

  const maxGridWidth = 85;
  const baseY = 48;
  drawGrid(doc, originalGrid, 14, baseY, maxGridWidth, 'Original Puzzle');
  drawGrid(doc, solvedGrid, 111, baseY, maxGridWidth, 'Solved Puzzle');

  doc.setFont('helvetica', 'bold');
  doc.text('Parameter Values Used', 14, 148);
  doc.setFont('helvetica', 'normal');
  let lineY = 154;
  Object.entries(params || {}).forEach(([key, value]) => {
    doc.text(`${key}: ${value}`, 14, lineY);
    lineY += 5;
    if (lineY > 285) {
      doc.addPage();
      lineY = 16;
    }
  });

  doc.save(`sudaco_solved_${size}x${size}_${Date.now()}.pdf`);
}

import { jsPDF } from 'jspdf';

function drawGrid(doc, grid, x, y, width, title, boldMask = null) {
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
      const isBold = boldMask?.[r]?.[c] === true;
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.text(String(value), tx, ty, { align: 'center' });
    }
  }
}

function buildFixedCellMask(initialGrid) {
  if (!initialGrid) return null;
  return initialGrid.map((row) => row.map((cell) => cell !== '' && cell != null));
}

export function downloadInitialGridPdf({ initialGrid, size }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SudACO - Initial Puzzle', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  doc.text(`Size: ${size}x${size}`, 14, 28);

  const gridWidth = 150;
  const gridX = 30;
  const gridY = 45;
  drawGrid(doc, initialGrid, gridX, gridY, gridWidth, 'Initial Puzzle', buildFixedCellMask(initialGrid));

  doc.save(`sudaco_initial_${size}x${size}_${Date.now()}.pdf`);
}

export function downloadPuzzleReportPdf({
  initialGrid,
  targetGrid,
  targetLabel = 'Current Progress',
  size,
  algorithmName = 'Multi-Colony DCM-ACO',
  params = {}
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SudACO - Puzzle Report', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  doc.text(`Size: ${size}x${size}`, 14, 28);
  doc.text(`Algorithm: ${algorithmName}`, 14, 33);

  const maxGridWidth = 85;
  const baseY = 43;
  drawGrid(doc, initialGrid, 14, baseY, maxGridWidth, 'Initial Puzzle');
  drawGrid(doc, targetGrid, 111, baseY, maxGridWidth, targetLabel, buildFixedCellMask(initialGrid));

  const paramEntries = Object.entries(params || {});
  if (paramEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Parameter Values Used', 14, 148);
    doc.setFont('helvetica', 'normal');
    let lineY = 154;
    paramEntries.forEach(([key, value]) => {
      doc.text(`${key}: ${value}`, 14, lineY);
      lineY += 5;
      if (lineY > 285) {
        doc.addPage();
        lineY = 16;
      }
    });
  }

  doc.save(`sudaco_report_${size}x${size}_${Date.now()}.pdf`);
}


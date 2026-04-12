import { jsPDF } from 'jspdf';

const UNIFIED_FONT_SIZE = 11;
const META_LINE_HEIGHT = 5;
const TITLE_TO_GRID_GAP = 4;

function drawGrid(doc, grid, x, y, width, title, boldMask = null) {
  const size = grid.length;
  const cell = width / size;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(UNIFIED_FONT_SIZE);
  doc.text(title, x + width / 2, y - TITLE_TO_GRID_GAP, { align: 'center' });

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
      const ty = y + r * cell + cell / 2;
      const isBold = boldMask?.[r]?.[c] === true;
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.text(String(value), tx, ty, { align: 'center', baseline: 'middle' });
    }
  }
}

function buildFixedCellMask(initialGrid) {
  if (!initialGrid) return null;
  return initialGrid.map((row) => row.map((cell) => cell !== '' && cell != null));
}

export function downloadInitialGridPdf({ initialGrid, size }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(UNIFIED_FONT_SIZE);
  doc.text('SudACO - Initial Puzzle', marginX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(UNIFIED_FONT_SIZE);
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, 16 + META_LINE_HEIGHT + 2);
  doc.text(`Size: ${size}x${size}`, marginX, 16 + (2 * META_LINE_HEIGHT) + 2);

  const gridWidth = 150;
  const gridX = 30;
  const gridY = 46;
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
  const marginX = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(UNIFIED_FONT_SIZE);
  doc.text('SudACO - Puzzle Report', marginX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(UNIFIED_FONT_SIZE);
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, 16 + META_LINE_HEIGHT + 2);
  doc.text(`Size: ${size}x${size}`, marginX, 16 + (2 * META_LINE_HEIGHT) + 2);
  doc.text(`Algorithm: ${algorithmName}`, marginX, 16 + (3 * META_LINE_HEIGHT) + 2);

  const maxGridWidth = 85;
  const baseY = 44;
  drawGrid(doc, initialGrid, 14, baseY, maxGridWidth, 'Initial Puzzle');
  drawGrid(doc, targetGrid, 111, baseY, maxGridWidth, targetLabel, buildFixedCellMask(initialGrid));

  const paramEntries = Object.entries(params || {});
  if (paramEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    const paramsTitleY = baseY + maxGridWidth + 10;
    doc.text('Parameter Values Used', marginX, paramsTitleY);
    doc.setFont('helvetica', 'normal');
    let lineY = paramsTitleY + 6;
    paramEntries.forEach(([key, value]) => {
      doc.text(`${key}: ${value}`, marginX, lineY);
      lineY += 5;
      if (lineY > 285) {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(UNIFIED_FONT_SIZE);
        doc.text('Parameter Values Used (continued)', marginX, 16);
        doc.setFont('helvetica', 'normal');
        lineY = 22;
      }
    });
  }

  doc.save(`sudaco_report_${size}x${size}_${Date.now()}.pdf`);
}


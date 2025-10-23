// File parser for instance .txt format
// Supports two formats:
// - Old format: Line 1=order (3,4,5), has order^4 values
// - New format: Line 1=size (6,12), has size^2 values

/**
 * Parse instance file content
 * @param {string} fileContent - Raw file content
 * @returns {Object} Parsed result with size and puzzleString
 */
export function parseInstanceFile(fileContent) {
  const lines = fileContent.trim().split('\n');
  
  if (lines.length < 3) {
    throw new Error('Invalid file format: File must have at least 3 lines');
  }
  
  // Parse first number (could be order or size)
  const firstLine = lines[0].trim();
  if (!firstLine) {
    throw new Error('Invalid file format: First line is empty. Expected size or order number');
  }
  
  const firstNumber = parseInt(firstLine);
  if (isNaN(firstNumber)) {
    throw new Error(`Invalid file format: First line "${firstLine}" is not a number`);
  }
  
  // Skip line 2 (unused)
  // Parse puzzle data (lines 3+)
  const puzzleLines = lines.slice(2);
  
  // Determine format based on number of lines
  let size;
  let isOldFormat = false;
  
  // Old format: firstNumber is order, has order^2 lines
  // New format: firstNumber is size, has size lines
  if (puzzleLines.length === firstNumber * firstNumber) {
    // Old format (9x9, 16x16, 25x25): firstNumber is order
    isOldFormat = true;
    size = firstNumber * firstNumber;
  } else if (puzzleLines.length === firstNumber) {
    // New format (6x6, 12x12): firstNumber is size
    isOldFormat = false;
    size = firstNumber;
  } else {
    throw new Error(`Invalid file format: expected ${firstNumber} or ${firstNumber * firstNumber} data lines, got ${puzzleLines.length}`);
  }
  
  // Validate size
  if (![6, 9, 12, 16, 25].includes(size)) {
    throw new Error(`Invalid puzzle size: ${size}. Must be 6, 9, 12, 16, or 25`);
  }
  
  // Parse each line and convert to puzzle string
  let puzzleString = '';
  
  for (const line of puzzleLines) {
    const values = line.trim().split(/\s+/); // Split on whitespace
    
    if (values.length !== size) {
      throw new Error(`Invalid line length: Expected ${size} values per line, got ${values.length}`);
    }
    
    for (const value of values) {
      const numValue = parseInt(value);
      
      if (isNaN(numValue)) {
        throw new Error(`Invalid value: ${value}. Must be a number`);
      }
      
      if (numValue === -1) {
        // Empty cell
        puzzleString += '.';
      } else if (numValue >= 1 && numValue <= size) {
        // Convert to appropriate character based on size
        puzzleString += instanceValueToChar(numValue, size);
      } else {
        throw new Error(`Invalid value: ${numValue}. Must be -1 or 1-${size}`);
      }
    }
  }
  
  return {
    size,
    puzzleString
  };
}

/**
 * Convert instance file value to puzzle string character
 * @param {number} value - Value from instance file (1-based)
 * @param {number} size - Grid size (6, 9, 12, 16, or 25)
 * @returns {string} Character for puzzle string
 */
function instanceValueToChar(value, size) {
  if (size === 6) {
    // 6x6: values 1-6 -> characters '1'-'6'
    return String(value);
  } else if (size === 9) {
    // 9x9: values 1-9 -> characters '1'-'9'
    return String(value);
  } else if (size === 12) {
    // 12x12: values 1-12 -> characters '0'-'9' then 'a'-'b'
    if (value <= 10) {
      return String(value - 1); // 1-10 -> 0-9
    } else {
      return String.fromCharCode(97 + value - 11); // 11-12 -> a-b
    }
  } else if (size === 16) {
    // 16x16: values 1-16 -> characters '0'-'9' then 'a'-'f'
    if (value <= 10) {
      return String(value - 1); // 1-10 -> 0-9
    } else {
      return String.fromCharCode(97 + value - 11); // 11-16 -> a-f
    }
  } else if (size === 25) {
    // 25x25: values 1-25 -> characters 'a'-'y'
    return String.fromCharCode(97 + value - 1); // 1-25 -> a-y
  }
  
  throw new Error(`Unsupported size: ${size}`);
}

/**
 * Validate instance file format before parsing
 * @param {string} fileContent - Raw file content
 * @returns {boolean} True if valid format
 */
export function validateInstanceFile(fileContent) {
  try {
    parseInstanceFile(fileContent);
    return true;
  } catch (error) {
    console.error('Instance file validation failed:', error.message);
    return false;
  }
}

/**
 * Get expected file format description
 * @returns {string} Description of expected format
 */
export function getInstanceFileFormatDescription() {
  return `Expected format:
Line 1: Size or order number
  - For 6×6 or 12×12: use size (6 or 12)
  - For 9×9, 16×16, 25×25: use order (3, 4, or 5)
Line 2: Unused integer (can be any number)
Lines 3+: Tab or space-separated values per row
- Use -1 for empty cells
- Use 1 to N for filled cells (where N is the grid size)
- Example for 6×6:
  6
  1
  -1 4 -1 2 -1 -1
  2 -1 5 -1 -1 -1
  ...`;
}

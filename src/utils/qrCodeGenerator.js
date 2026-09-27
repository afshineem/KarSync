/**
 * Lightweight, zero-dependency QR Code SVG generator in pure JavaScript.
 * Supports Byte mode (UTF-8 / ASCII) with Error Correction Level M/L.
 * Generates crisp, responsive SVG strings suitable for direct rendering or <img> src.
 */

// GF(256) Math tables for Reed-Solomon Error Correction
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
})();

function gmult(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

// Precomputed Generator Polynomials for EC levels
function getGeneratorPolynomial(numEcc) {
  let poly = [1];
  for (let i = 0; i < numEcc; i++) {
    const factor = [1, EXP_TABLE[i]];
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j];
      newPoly[j + 1] ^= gmult(poly[j], factor[1]);
    }
    poly = newPoly;
  }
  return poly;
}

function calculateReedSolomon(data, numEcc) {
  const gen = getGeneratorPolynomial(numEcc);
  const result = new Array(numEcc).fill(0);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.shift();
    result.push(0);
    if (factor !== 0) {
      for (let j = 0; j < numEcc; j++) {
        result[j] ^= gmult(gen[j + 1], factor);
      }
    }
  }
  return result;
}

// QR Code Versions & Capacities (Version 1 to 10 for TOTP URIs, Level M)
// format: [version, size, totalBytes, ecBytesPerBlock, numBlocks]
const VERSION_TABLE = [
  null,
  { v: 1, size: 21, totalData: 16, ecPerBlock: 10, blocks: 1 },
  { v: 2, size: 25, totalData: 28, ecPerBlock: 16, blocks: 1 },
  { v: 3, size: 29, totalData: 44, ecPerBlock: 26, blocks: 1 },
  { v: 4, size: 33, totalData: 64, ecPerBlock: 18, blocks: 2 },
  { v: 5, size: 37, totalData: 86, ecPerBlock: 24, blocks: 2 },
  { v: 6, size: 41, totalData: 108, ecPerBlock: 16, blocks: 4 },
  { v: 7, size: 45, totalData: 124, ecPerBlock: 18, blocks: 4 },
  { v: 8, size: 49, totalData: 154, ecPerBlock: 22, blocks: 4 },
  { v: 9, size: 53, totalData: 182, ecPerBlock: 22, blocks: 5 },
  { v: 10, size: 57, totalData: 216, ecPerBlock: 26, blocks: 5 }
];

const ALIGNMENT_PATTERN_POS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

/**
 * Creates QR Matrix for a given string
 */
export function generateQRMatrix(text) {
  const enc = new TextEncoder();
  const textBytes = enc.encode(text);

  // Pick smallest fitting version
  let info = null;
  for (let v = 1; v <= 10; v++) {
    const candidate = VERSION_TABLE[v];
    // Byte mode overhead: 4 bits mode + 8 bits length (v 1-9) + 4 bits terminator
    const requiredDataBytes = textBytes.length + 2;
    if (candidate.totalData >= requiredDataBytes) {
      info = candidate;
      break;
    }
  }

  if (!info) {
    info = VERSION_TABLE[10];
  }

  // 1. Bit Stream construction (Byte Mode 0100)
  const bitStream = [];
  function pushBits(val, bitCount) {
    for (let i = bitCount - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  // Mode: Byte (0100)
  pushBits(0b0100, 4);
  // Character count
  pushBits(textBytes.length, info.v <= 9 ? 8 : 16);
  // Data bytes
  for (let i = 0; i < textBytes.length; i++) {
    pushBits(textBytes[i], 8);
  }
  // Terminator: up to 4 zero bits
  const totalBitCapacity = info.totalData * 8;
  const terminatorLen = Math.min(4, totalBitCapacity - bitStream.length);
  for (let i = 0; i < terminatorLen; i++) bitStream.push(0);

  // Pad to multiple of 8
  while (bitStream.length % 8 !== 0) bitStream.push(0);

  // Convert bits to bytes
  const dataBytes = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bitStream[i + j];
    dataBytes.push(b);
  }

  // Pad bytes (0xEC, 0x11)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < info.totalData) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // 2. Error Correction Coding & Block Interleaving
  const blocksData = [];
  const blocksEc = [];
  const baseBlockLen = Math.floor(info.totalData / info.blocks);
  const extraBlocks = info.totalData % info.blocks;

  let offset = 0;
  for (let b = 0; b < info.blocks; b++) {
    const curLen = baseBlockLen + (b >= info.blocks - extraBlocks ? 1 : 0);
    const blk = dataBytes.slice(offset, offset + curLen);
    offset += curLen;
    blocksData.push(blk);
    blocksEc.push(calculateReedSolomon(blk, info.ecPerBlock));
  }

  // Interleave data bytes
  const finalSequence = [];
  const maxDataLen = Math.max(...blocksData.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < info.blocks; b++) {
      if (i < blocksData[b].length) {
        finalSequence.push(blocksData[b][i]);
      }
    }
  }
  // Interleave EC bytes
  for (let i = 0; i < info.ecPerBlock; i++) {
    for (let b = 0; b < info.blocks; b++) {
      finalSequence.push(blocksEc[b][i]);
    }
  }

  // Convert interleaved sequence to bit array
  const finalBits = [];
  for (let i = 0; i < finalSequence.length; i++) {
    for (let k = 7; k >= 0; k--) {
      finalBits.push((finalSequence[i] >> k) & 1);
    }
  }
  // Remainder bits for version
  const remainderBits = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0][info.v] || 0;
  for (let i = 0; i < remainderBits; i++) finalBits.push(0);

  // 3. Matrix Construction
  const size = info.size;
  const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size).fill(0));

  function setModule(r, c, val) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val ? 1 : 0;
      reserved[r][c] = 1;
    }
  }

  // Finder Patterns (Top-Left, Top-Right, Bottom-Left)
  function drawFinderPattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            setModule(nr, nc, 1);
          } else {
            setModule(nr, nc, 0);
          }
        }
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, size - 7);
  drawFinderPattern(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0 ? 1 : 0);
    setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_PATTERN_POS[info.v] || [];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const ar = alignCoords[i];
      const ac = alignCoords[j];
      // Skip if collides with finder patterns
      if (
        (ar <= 8 && ac <= 8) ||
        (ar <= 8 && ac >= size - 8) ||
        (ar >= size - 8 && ac <= 8)
      ) {
        continue;
      }
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isBlack =
            Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setModule(ar + r, ac + c, isBlack ? 1 : 0);
        }
      }
    }
  }

  // Dark module
  setModule(4 * info.v + 9, 8, 1);

  // Reserve format info area
  for (let i = 0; i <= 8; i++) {
    reserved[8][i] = 1;
    reserved[i][8] = 1;
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }

  // 4. Place Data Modules with standard mask pattern 0: (row + col) % 2 === 0
  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const cols = [right, right - 1];

    const rows = [];
    if (upwards) {
      for (let r = size - 1; r >= 0; r--) rows.push(r);
    } else {
      for (let r = 0; r < size; r++) rows.push(r);
    }

    for (const r of rows) {
      for (const c of cols) {
        if (!reserved[r][c]) {
          let val = 0;
          if (bitIdx < finalBits.length) {
            val = finalBits[bitIdx++];
          }
          // Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) val ^= 1;
          matrix[r][c] = val;
        }
      }
    }
    upwards = !upwards;
  }

  // Format Information: Level M (00) + Mask 0 (000) => 0b00000 => BCH => 0b101010000010010
  // XOR mask 0b101010000010010 ^ 0b101010000010010 = 0...
  // Format bit sequence for Level M + Mask 0 with 101010000010010 standard:
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Draw format bits
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i];

  // Draw copy of format bits
  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i];
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i];

  return matrix;
}

/**
 * Generates an SVG string of the QR Code
 * @param {string} text 
 * @param {object} options { size: number, margin: number, darkColor: string, lightColor: string }
 * @returns {string} SVG markup
 */
export function generateQRCodeSVG(text, options = {}) {
  const matrix = generateQRMatrix(text);
  const matrixSize = matrix.length;
  const margin = options.margin !== undefined ? options.margin : 2;
  const totalDim = matrixSize + margin * 2;
  const darkColor = options.darkColor || '#0f172a';
  const lightColor = options.lightColor || '#ffffff';

  let rects = [];
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c] === 1) {
        rects.push(`<rect x="${c + margin}" y="${r + margin}" width="1.02" height="1.02" fill="${darkColor}" />`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" shape-rendering="crispEdges" class="w-full h-full">
    <rect width="${totalDim}" height="${totalDim}" fill="${lightColor}" rx="1" />
    ${rects.join('')}
  </svg>`;
}

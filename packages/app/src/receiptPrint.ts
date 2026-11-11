/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Compact, single-column receipt PNG export using the existing print puzzles.
 */
import { LEVEL_NAMES, type PrintSudoku } from './protocol';

export const RECEIPT_WIDTH = 384;
export const RECEIPT_CARD_HEIGHT = 476;
export const RECEIPT_CARDS_PER_STRIP = 10;

/** Coordinates from the 384px thermal-printer reference sheet. */
export const RECEIPT_X_LINES = [13, 52, 92, 133, 172, 212, 253, 292, 332, 373] as const;
export const RECEIPT_Y_LINES = [71, 110, 150, 191, 230, 270, 311, 350, 390, 431] as const;

export interface ReceiptCard {
  puzzle: PrintSudoku;
  /** Position within the exported, possibly shuffled batch. */
  order: number;
  /** Per-difficulty serial number, starting at 1 for each export. */
  number: number;
}

/** Order puzzles for printing, then number each difficulty independently. Never mutates the input. */
export function prepareReceiptCards(
  puzzles: readonly PrintSudoku[],
  shuffle = false,
  random: () => number = Math.random,
): ReceiptCard[] {
  const ordered = [...puzzles];
  if (shuffle) {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }
  const counts = new Map<number, number>();
  return ordered.map((puzzle, i) => {
    const number = (counts.get(puzzle.level) ?? 0) + 1;
    counts.set(puzzle.level, number);
    return { puzzle, order: i + 1, number };
  });
}

export function splitReceiptCards(cards: readonly ReceiptCard[], perStrip = RECEIPT_CARDS_PER_STRIP): ReceiptCard[][] {
  if (!Number.isInteger(perStrip) || perStrip < 1) throw new RangeError('Invalid receipt strip length.');
  const strips: ReceiptCard[][] = [];
  for (let i = 0; i < cards.length; i += perStrip) strips.push(cards.slice(i, i + perStrip));
  return strips;
}

function drawCard(ctx: CanvasRenderingContext2D, card: ReceiptCard, y: number, answer: boolean): void {
  const { puzzle, number } = card;
  ctx.fillStyle = '#ebebeb';
  ctx.fillRect(0, y, RECEIPT_WIDTH, RECEIPT_CARD_HEIGHT);

  ctx.fillStyle = '#101010';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '700 17px Arial, sans-serif';
  ctx.fillText('SUDOKU', 13, y + 19);

  ctx.font = '700 13px Arial, sans-serif';
  ctx.textAlign = 'right';
  const label = String(LEVEL_NAMES[puzzle.level] ?? 'Sudoku').toUpperCase();
  ctx.fillText(label + '  #' + String(number).padStart(2, '0') + '  ' + puzzle.score, 371, y + 24);

  for (let i = 0; i <= 9; i++) {
    const thick = i % 3 === 0;
    const lineWidth = thick ? 3 : 1;
    ctx.fillStyle = thick ? '#101010' : '#999999';
    ctx.fillRect(RECEIPT_X_LINES[i] - Math.floor(lineWidth / 2), y + RECEIPT_Y_LINES[0], lineWidth, RECEIPT_Y_LINES[9] - RECEIPT_Y_LINES[0]);
    ctx.fillRect(RECEIPT_X_LINES[0], y + RECEIPT_Y_LINES[i] - Math.floor(lineWidth / 2), RECEIPT_X_LINES[9] - RECEIPT_X_LINES[0], lineWidth);
  }

  const digits = answer ? puzzle.solution : [...puzzle.givens].map((v) => (v === '.' || v === '0' ? 0 : Number(v)));
  if (!digits || digits.length !== 81) throw new Error('This puzzle has no 81-cell solution for the answer strip.');
  ctx.fillStyle = '#0b0b0b';
  ctx.font = '700 27px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let cell = 0; cell < 81; cell++) {
    const digit = digits[cell];
    if (!digit) continue;
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const x = (RECEIPT_X_LINES[col] + RECEIPT_X_LINES[col + 1]) / 2;
    const yy = y + (RECEIPT_Y_LINES[row] + RECEIPT_Y_LINES[row + 1]) / 2;
    ctx.fillText(String(digit), x, yy + 1);
  }
}

/** A printable 384px-wide PNG containing a vertical strip of up to ten puzzles. */
async function makeStrip(cards: readonly ReceiptCard[], answer: boolean): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = RECEIPT_WIDTH;
  canvas.height = RECEIPT_CARD_HEIGHT * cards.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the receipt image.');
  cards.forEach((card, index) => drawCard(ctx, card, index * RECEIPT_CARD_HEIGHT, answer));
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((data) => data ? resolve(data) : reject(new Error('Could not encode the receipt PNG.')), 'image/png'),
  );
  // Release the potentially tall canvas before starting the next strip.
  canvas.width = 0;
  canvas.height = 0;
  return new Uint8Array(await blob.arrayBuffer());
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

const write16 = (dv: DataView, offset: number, value: number) => dv.setUint16(offset, value, true);
const write32 = (dv: DataView, offset: number, value: number) => dv.setUint32(offset, value, true);
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const n of data) crc = crcTable[(crc ^ n) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Small dependency-free ZIP (uncompressed/store); PNGs are already compressed. */
export function receiptZip(entries: readonly ZipEntry[]): Blob {
  if (entries.length > 65535) throw new RangeError('Too many receipt files.');
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const directoryParts: Uint8Array[] = [];
  let localOffset = 0;
  let directorySize = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    if (!name.length || name.length > 65535) throw new RangeError('Invalid receipt filename.');
    if (entry.bytes.byteLength > 0xffffffff) throw new RangeError('Receipt PNG too large.');
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    write32(l, 0, 0x04034b50);
    write16(l, 4, 20);
    write16(l, 6, 0x0800); // UTF-8 names
    write16(l, 10, 0); // time
    write16(l, 12, 0x0021); // 1980-01-01
    write32(l, 14, crc);
    write32(l, 18, entry.bytes.byteLength);
    write32(l, 22, entry.bytes.byteLength);
    write16(l, 26, name.length);
    local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    write32(c, 0, 0x02014b50);
    write16(c, 4, 20);
    write16(c, 6, 20);
    write16(c, 8, 0x0800);
    write16(c, 14, 0x0021);
    write32(c, 16, crc);
    write32(c, 20, entry.bytes.byteLength);
    write32(c, 24, entry.bytes.byteLength);
    write16(c, 28, name.length);
    write32(c, 42, localOffset);
    central.set(name, 46);
    directoryParts.push(central);
    directorySize += central.length;
    localOffset += local.length + entry.bytes.byteLength;
    if (localOffset + directorySize > 0xffffffff) throw new RangeError('Receipt archive too large.');
  }

  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  write32(e, 0, 0x06054b50);
  write16(e, 8, entries.length);
  write16(e, 10, entries.length);
  write32(e, 12, directorySize);
  write32(e, 16, localOffset);

  const result = new Uint8Array(localOffset + directorySize + end.length);
  let offset = 0;
  for (const part of [...localParts, ...directoryParts, end]) {
    result.set(part, offset);
    offset += part.length;
  }
  return new Blob([result], { type: 'application/zip' });
}

/** Export the paired puzzle and answer strips as a single ZIP download. */
export async function downloadReceiptPngs(puzzles: readonly PrintSudoku[], shuffle: boolean): Promise<void> {
  if (puzzles.length === 0) throw new Error('No puzzles to export.');
  const cards = prepareReceiptCards(puzzles, shuffle);
  const strips = splitReceiptCards(cards);
  const files: ZipEntry[] = [];
  for (let i = 0; i < strips.length; i++) {
    const group = strips[i];
    const first = String(group[0].order).padStart(3, '0');
    const last = String(group[group.length - 1].order).padStart(3, '0');
    const prefix = String(i + 1).padStart(2, '0') + '_' + first + '-' + last + '_';
    files.push({ name: prefix + 'puzzles.png', bytes: await makeStrip(group, false) });
    files.push({ name: prefix + 'answers.png', bytes: await makeStrip(group, true) });
  }
  files.push({
    name: 'README.txt',
    bytes: new TextEncoder().encode(
      'Hodoku Revisited - 384px thermal receipt export\n' +
      'Print the numbered puzzle PNGs in filename order. Answer PNGs have matching order and headers.\n' +
      'Each puzzle is 384x476px; strips contain up to 10 puzzles (4760px maximum).\n' +
      'Difficulty-specific numbers start at #01 within this export. Scores come from the HoDoKu engine.\n' +
      'Learning/practicing sections export the original givens, not a partly solved training board.\n',
    ),
  });
  const url = URL.createObjectURL(receiptZip(files));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hodoku-receipt-384px.zip';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

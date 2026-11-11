import { describe, expect, it } from 'vitest';
import { RECEIPT_CARD_HEIGHT, RECEIPT_WIDTH, prepareReceiptCards, receiptZip, splitReceiptCards } from '../src/receiptPrint';
import type { PrintSudoku } from '../src/protocol';

const puzzle = (level: number, score: number): PrintSudoku => ({
  givens: '.'.repeat(81),
  values: Array(81).fill(0),
  cands: Array(81).fill(0),
  solution: Array(81).fill(1),
  level,
  score,
  showCands: false,
});

describe('receipt print layout', () => {
  it('keeps the reference 384x476px geometry', () => {
    expect(RECEIPT_WIDTH).toBe(384);
    expect(RECEIPT_CARD_HEIGHT).toBe(476);
  });

  it('numbers puzzles within each level without mutating the input order', () => {
    const input = [puzzle(2, 400), puzzle(1, 300), puzzle(2, 500), puzzle(5, 4000)];
    const cards = prepareReceiptCards(input);
    expect(cards.map((c) => c.number)).toEqual([1, 1, 2, 1]);
    expect(cards.map((c) => c.order)).toEqual([1, 2, 3, 4]);
    expect(input.map((p) => p.level)).toEqual([2, 1, 2, 5]);
  });

  it('can interleave difficulty while preserving score and pairing', () => {
    const input = [puzzle(1, 200), puzzle(2, 500), puzzle(3, 1000), puzzle(1, 240)];
    const cards = prepareReceiptCards(input, true, () => 0);
    expect(cards.map((c) => c.puzzle.level)).not.toEqual(input.map((c) => c.level));
    expect(cards.map((c) => c.puzzle.score).sort()).toEqual([200, 240, 500, 1000]);
    expect(cards.filter((c) => c.puzzle.level === 1).map((c) => c.number)).toEqual([1, 2]);
  });

  it('splits long jobs into ten-puzzle sheets with no missing puzzles', () => {
    const cards = prepareReceiptCards(Array.from({ length: 23 }, (_, i) => puzzle((i % 5) + 1, i * 10)));
    const strips = splitReceiptCards(cards);
    expect(strips.map((s) => s.length)).toEqual([10, 10, 3]);
    expect(strips.flat().map((c) => c.order)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(() => splitReceiptCards(cards, 0)).toThrow(RangeError);
  });
});

describe('receipt ZIP archive', () => {
  it('writes a valid local record, directory and end record with stored bytes', async () => {
    const name = 'puzzles.png';
    const payload = new Uint8Array([137, 80, 78, 71]);
    const archive = receiptZip([{ name, bytes: payload }]);
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(archive.type).toBe('application/zip');
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(18, true)).toBe(payload.length);
    expect(new TextDecoder().decode(bytes.slice(30, 30 + name.length))).toBe(name);
    expect([...bytes.slice(30 + name.length, 30 + name.length + payload.length)]).toEqual([...payload]);
    const cd = 30 + name.length + payload.length;
    expect(view.getUint32(cd, true)).toBe(0x02014b50);
    expect(view.getUint32(cd + 16, true)).toBe(view.getUint32(14, true));
    const end = cd + 46 + name.length;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(1);
  });
});

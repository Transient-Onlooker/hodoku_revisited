import { describe, expect, it } from 'vitest';
import { RECEIPT_CARD_HEIGHT, RECEIPT_WIDTH, planReceiptStrips, prepareReceiptCards, receiptZip, splitReceiptCards } from '../src/receiptPrint';
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
    expect(cards.map((c) => c.number)).toEqual([1, 2, 1, 1]);
    expect(cards.map((c) => c.order)).toEqual([1, 2, 3, 4]);
    expect(cards.map((c) => c.puzzle.level)).toEqual([2, 2, 1, 5]);
    expect(input.map((p) => p.level)).toEqual([2, 1, 2, 5]);
  });

  it('shuffles only within difficulty groups, never across them', () => {
    const input = [puzzle(1, 200), puzzle(2, 500), puzzle(1, 240), puzzle(3, 1000), puzzle(2, 550)];
    const cards = prepareReceiptCards(input, true, () => 0);
    expect(cards.map((c) => c.puzzle.level)).toEqual([1, 1, 2, 2, 3]);
    expect(cards.map((c) => c.puzzle.score)).toEqual([240, 200, 550, 500, 1000]);
    expect(cards.map((c) => c.number)).toEqual([1, 2, 1, 2, 1]);
    expect(input.map((c) => c.score)).toEqual([200, 500, 240, 1000, 550]);
  });

  it('creates seven difficulty-homogeneous strips for a 20/30/10/10 batch', () => {
    const input = [
      ...Array.from({ length: 20 }, (_, i) => puzzle(1, 100 + i)),
      ...Array.from({ length: 30 }, (_, i) => puzzle(2, 200 + i)),
      ...Array.from({ length: 10 }, (_, i) => puzzle(3, 300 + i)),
      ...Array.from({ length: 10 }, (_, i) => puzzle(5, 500 + i)),
    ];
    const strips = planReceiptStrips(prepareReceiptCards(input, true, () => 0));
    expect(strips).toHaveLength(7);
    expect(strips.map((s) => s.level)).toEqual([1, 1, 2, 2, 2, 3, 5]);
    expect(strips.map((s) => s.part)).toEqual([1, 2, 1, 2, 3, 1, 1]);
    expect(strips.map((s) => s.cards.length)).toEqual(Array(7).fill(10));
    expect(strips.every((s) => s.cards.every((card) => card.puzzle.level === s.level))).toBe(true);
    expect(strips.flatMap((s) => s.cards)).toHaveLength(70);
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

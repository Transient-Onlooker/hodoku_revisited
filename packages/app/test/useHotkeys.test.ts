import { describe, expect, it } from 'vitest';
import { isNotesToggleShortcut } from '../src/hooks/useHotkeys';

describe('Value/Notes keyboard shortcut', () => {
  it('always keeps N as a shortcut', () => {
    for (const choice of ['n', 'Tab', 'Enter'] as const) {
      expect(isNotesToggleShortcut('n', choice, false, false)).toBe(true);
    }
  });

  it('only intercepts Tab on the board and leaves Shift+Tab for focus navigation', () => {
    expect(isNotesToggleShortcut('Tab', 'n', true, false)).toBe(false);
    expect(isNotesToggleShortcut('Tab', 'Tab', false, false)).toBe(false);
    expect(isNotesToggleShortcut('Tab', 'Tab', true, true)).toBe(false);
    expect(isNotesToggleShortcut('Tab', 'Tab', true, false)).toBe(true);
  });

  it('only uses Enter for notes when enabled and a board cell has focus', () => {
    expect(isNotesToggleShortcut('Enter', 'n', true, false)).toBe(false);
    expect(isNotesToggleShortcut('Enter', 'Tab', true, false)).toBe(false);
    expect(isNotesToggleShortcut('Enter', 'Enter', false, false)).toBe(false);
    expect(isNotesToggleShortcut('Enter', 'Enter', true, false)).toBe(true);
    expect(isNotesToggleShortcut('Enter', 'Enter', true, true)).toBe(false);
  });
});

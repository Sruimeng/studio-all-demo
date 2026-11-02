import { describe, expect, it } from 'vitest';
import { selectionAction } from '../app/@feature/segmentation/selection';
describe('2D selection shortcuts', () => {
  it('uses Command or Ctrl to add and Alt to subtract, overriding the toolbar mode', () => {
    expect(selectionAction({ altKey: false, ctrlKey: true, metaKey: false }, 'replace')).toBe('add');
    expect(selectionAction({ altKey: false, ctrlKey: false, metaKey: true }, 'subtract')).toBe('add');
    expect(selectionAction({ altKey: true, ctrlKey: true, metaKey: true }, 'replace')).toBe('subtract');
    expect(selectionAction({ altKey: false, ctrlKey: false, metaKey: false }, 'subtract')).toBe('subtract');
  });
});

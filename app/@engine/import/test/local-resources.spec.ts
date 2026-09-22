import { describe, expect, it } from 'vitest';
import { matchLocalResource, normalizeResourcePath } from '../local-model';

describe('local texture paths', () => {
  it('matches Windows paths and escaped names', () => {
    const image = new File([''], 'Body Color.png');
    expect(matchLocalResource('C:\\export\\Body%20Color.png', [image])).toBe(image);
    expect(normalizeResourcePath('.\\Textures\\RED.PNG')).toBe('textures/red.png');
  });

  it('refuses ambiguous basename matches', () => {
    const first = new File(['a'], 'color.png');
    const second = new File(['b'], 'color.png');
    expect(matchLocalResource('color.png', [first, second])).toBeUndefined();
  });

  it('prefers directory-qualified files', () => {
    const first = new File(['a'], 'color.png');
    const second = new File(['b'], 'color.png');
    Object.defineProperty(first, 'webkitRelativePath', { value: 'model/red/color.png' });
    Object.defineProperty(second, 'webkitRelativePath', { value: 'model/blue/color.png' });
    expect(matchLocalResource('model/blue/color.png', [first, second])).toBe(second);
  });
});

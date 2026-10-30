import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed } from 'vue';
import { useLocale } from '../app/@base/locale';
import { englishText } from '../app/@base/locale/translate';
import { englishMessages } from '../app/@base/locale/messages';
import { canonicalPrompt, presetTarget, promptExamples, suggestedPrompt } from '../app/@feature/segmentation/reference';

beforeEach(() => {
  setActivePinia(createPinia());
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  vi.stubGlobal('document', { documentElement: { lang: '' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('workspace language', () => {
  it('keeps existing Chinese copy and changes displayed text reactively without mutating the source', () => {
    const locale = useLocale();
    const source = { name: '身体', prompt: suggestedPrompt('parts'), confirmed: true };
    const before = JSON.stringify(source);
    const label = computed(() => locale.tr(source.name));
    locale.restore();
    expect(locale.t('Multicolor print', '多色打印')).toBe('多色打印');
    expect(locale.tr('在 Multi-color 中编辑')).toBe('在 Multi-color 中编辑');
    expect(document.documentElement.lang).toBe('zh-CN');
    locale.toggle();
    expect(label.value).toBe('Body');
    expect(locale.tr(source.prompt)).not.toMatch(/\p{Script=Han}/u);
    expect(locale.tr(4)).toBe(4);
    expect(JSON.stringify(source)).toBe(before);
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('studio-language')).toBe('en');
    setActivePinia(createPinia());
    const restored = useLocale(); restored.restore();
    expect(restored.language).toBe('en');
    locale.toggle();
    expect(label.value).toBe('身体');
    expect(locale.tr(source.prompt)).toBe(source.prompt);
  });

  it('still switches when browser storage is blocked and ignores invalid stored preferences', () => {
    localStorage.setItem('studio-language', 'invalid');
    const locale = useLocale(); locale.restore();
    expect(locale.language).toBe('zh');
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    expect(() => locale.restore()).not.toThrow();
    expect(() => locale.toggle()).not.toThrow();
    expect(locale.language).toBe('en');
  });

  it('translates dynamic progress, nested messages and numbered demo parts', () => {
    expect(englishText('采样面颜色 1,024/4,096')).toBe('Sampling surface colors: 1,024/4,096');
    expect(englishText('写入 3MF：1,024/4,096 面')).toBe('Writing 3MF: 1,024/4,096 faces');
    expect(englishText('选择红色区域')).toBe('Select Red region');
    expect(englishText('新部件 12')).toBe('New part 12');
    expect(englishText('红色区域 · 深色')).toBe('Red region · Dark');
    expect(englishText('待完成：确认尺寸、颜色设置')).not.toMatch(/\p{Script=Han}/u);
    expect(englishText('自定义测试蓝')).toBe('自定义测试蓝');
    expect(englishText('CUSTOM-123')).toBe('CUSTOM-123');
    for (const value of Object.values(englishMessages)) expect(value).not.toMatch(/\p{Script=Han}/u);
  });

  it('accepts translated demo prompts without changing their segmentation rules', () => {
    for (const mode of ['parts', 'colors'] as const) {
      for (const prompt of [...promptExamples[mode], suggestedPrompt(mode)]) {
        const canonical = canonicalPrompt(mode, englishText(prompt));
        expect(canonical).toBe(prompt);
        expect(presetTarget(mode, canonical)).toBe(presetTarget(mode, prompt));
      }
    }
    expect(canonicalPrompt('parts', 'Keep my custom instructions')).toBe('Keep my custom instructions');
  });
});

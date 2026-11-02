import { defineStore } from 'pinia';
import { ref } from 'vue';
import { englishText } from './translate';

export const useLocale = defineStore('locale', () => {
  const language = ref<'zh' | 'en'>('zh');
  const t = (en: string, zh: string) => language.value === 'zh' ? zh : en;
  const tr = <T>(value: T): T => (language.value === 'en' && typeof value === 'string' ? englishText(value) : value) as T;
  const updateDocument = () => {
    if (typeof document !== 'undefined') document.documentElement.lang = language.value === 'en' ? 'en' : 'zh-CN';
  };
  const toggle = () => {
    language.value = language.value === 'zh' ? 'en' : 'zh';
    updateDocument();
    try { localStorage.setItem('studio-language', language.value); } catch { /* Switching still works when storage is unavailable. */ }
  };
  const restore = () => {
    let stored: string | null = null;
    try { stored = localStorage.getItem('studio-language'); } catch { /* Use the default language. */ }
    language.value = stored === 'en' ? 'en' : 'zh';
    updateDocument();
  };
  return { language, t, tr, toggle, restore };
});

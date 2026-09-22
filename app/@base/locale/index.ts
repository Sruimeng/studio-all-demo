import { defineStore } from 'pinia';
import { ref } from 'vue';
export const useLocale = defineStore('locale', () => {
  const language = ref<'zh' | 'en'>('zh');
  const t = (en: string, zh: string) => language.value === 'zh' ? zh : en;
  const toggle = () => { language.value = language.value === 'zh' ? 'en' : 'zh'; localStorage.setItem('studio-language', language.value); };
  const restore = () => {
    const stored = localStorage.getItem('studio-language');
    language.value = stored === 'en' ? 'en' : 'zh';
  };
  return { language, t, toggle, restore };
});

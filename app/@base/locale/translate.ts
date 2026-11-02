import { englishMessages } from './messages';

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(englishMessages).filter(([source]) => /\{\d+\}/.test(source)).map(([source, target]) => {
  const keys: string[] = [];
  const expression = source.split(/(\{\d+\})/).map(part => {
    if (/^\{\d+\}$/.test(part)) { keys.push(part); return '([\\s\\S]*?)'; }
    return escape(part);
  }).join('');
  return { pattern: new RegExp(`^${expression}$`), target, keys };
});

/** Translate application copy at the display boundary, including saved status messages. */
export function englishText(value: string): string {
  if (!/\p{Script=Han}/u.test(value)) return value;
  if (englishMessages[value] !== undefined) return englishMessages[value]!;
  const trimmed = value.trim();
  if (trimmed !== value && englishMessages[trimmed] !== undefined) return value.replace(trimmed, englishMessages[trimmed]!);
  for (const { pattern, target, keys } of patterns) {
    const match = value.match(pattern);
    if (match) return target.replace(/\{\d+\}/g, key => englishText(match[keys.indexOf(key) + 1] ?? key));
  }
  // Demo-generated numbered group names and combined validation messages.
  const numbered = value.match(/^(.*?)(\s+\d+)$/);
  if (numbered && englishMessages[numbered[1]!]) return englishMessages[numbered[1]!] + numbered[2]!;
  const segments = value.split(/(、|；|\n)/);
  if (segments.length > 1) return segments.map(segment => segment === '、' ? ', ' : segment === '；' ? '; ' : segment === '\n' ? segment : englishText(segment)).join('');
  return value;
}

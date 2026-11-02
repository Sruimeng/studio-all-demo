export type ImagePoint = { x: number; y: number };
export function selectionAction(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }, fallback: 'replace' | 'add' | 'subtract') {
  return event.altKey ? 'subtract' : event.ctrlKey || event.metaKey ? 'add' : fallback;
}
export function textInput(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}

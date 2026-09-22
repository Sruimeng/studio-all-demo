import { InjectionKey } from 'vue';
export interface TooltipTouchContext {
    closeByTouch: () => void;
    toggleByTouch: () => void;
}
export declare const TOOLTIP_TOUCH_KEY: InjectionKey<TooltipTouchContext>;

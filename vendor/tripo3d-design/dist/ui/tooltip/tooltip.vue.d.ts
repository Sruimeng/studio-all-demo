import { TooltipRootProps } from 'reka-ui';
export interface TooltipProps extends TooltipRootProps {
    touchable?: boolean;
}
declare var __VLS_14: {}, __VLS_22: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_14) => any;
} & {
    default?: (props: typeof __VLS_22) => any;
};
declare const __VLS_base: import('vue').DefineComponent<TooltipProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
    "update:open": (value: boolean) => any;
}, string, import('vue').PublicProps, Readonly<TooltipProps> & Readonly<{
    "onUpdate:open"?: ((value: boolean) => any) | undefined;
}>, {
    delayDuration: number;
    ignoreNonKeyboardFocus: boolean;
    touchable: boolean;
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};

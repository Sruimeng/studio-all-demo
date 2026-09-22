import { TooltipContentProps } from 'reka-ui';
import { Classed } from '../../type';
type __VLS_Props = TooltipContentProps & Classed;
declare var __VLS_16: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_16) => any;
};
declare const __VLS_base: import('vue').DefineComponent<__VLS_Props, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
    escapeKeyDown: (event: KeyboardEvent) => any;
    pointerDownOutside: (event: Event) => any;
}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{
    onEscapeKeyDown?: ((event: KeyboardEvent) => any) | undefined;
    onPointerDownOutside?: ((event: Event) => any) | undefined;
}>, {
    side: "bottom" | "left" | "right" | "top";
    sideOffset: number;
    avoidCollisions: boolean;
    collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};

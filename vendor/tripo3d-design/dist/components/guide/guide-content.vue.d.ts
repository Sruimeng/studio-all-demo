import { TooltipContentProps } from 'reka-ui';
import { Classed } from '../../type';
type Extra = {
    alt?: string;
    description?: string;
    img?: string;
    title?: string;
};
type __VLS_Props = TooltipContentProps & Classed & Extra;
declare var __VLS_8: {}, __VLS_10: {}, __VLS_12: {}, __VLS_14: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_8) => any;
} & {
    img?: (props: typeof __VLS_10) => any;
} & {
    title?: (props: typeof __VLS_12) => any;
} & {
    description?: (props: typeof __VLS_14) => any;
};
declare const __VLS_base: import('vue').DefineComponent<__VLS_Props, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
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

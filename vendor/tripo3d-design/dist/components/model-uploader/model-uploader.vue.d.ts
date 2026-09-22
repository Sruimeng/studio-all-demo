import { Classed } from '../../type';
type __VLS_Props = Classed & {
    description?: string;
    icon?: string;
    required?: boolean;
    size?: number;
    title?: string;
};
declare var __VLS_6: {}, __VLS_8: {};
type __VLS_Slots = {} & {
    title?: (props: typeof __VLS_6) => any;
} & {
    description?: (props: typeof __VLS_8) => any;
};
declare const __VLS_base: import('vue').DefineComponent<__VLS_Props, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
    change: (file: File) => any;
    "size-error": (file: File) => any;
    "type-error": (file: File) => any;
}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{
    onChange?: ((file: File) => any) | undefined;
    "onSize-error"?: ((file: File) => any) | undefined;
    "onType-error"?: ((file: File) => any) | undefined;
}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};

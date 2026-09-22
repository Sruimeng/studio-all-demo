type __VLS_Props = {
    multiple?: boolean;
    size?: number;
};
declare const __VLS_export: import('vue').DefineComponent<__VLS_Props, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
    change: (file: File[]) => any;
    "size-error": (msg: File) => any;
    "type-error": (msg: File) => any;
}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{
    onChange?: ((file: File[]) => any) | undefined;
    "onSize-error"?: ((msg: File) => any) | undefined;
    "onType-error"?: ((msg: File) => any) | undefined;
}>, {
    size: number;
    multiple: boolean;
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;

import { ConfirmProps } from './type';
type __VLS_Slots = {
    cancel?: () => void;
    confirm?: () => void;
    description?: () => void;
    title?: () => void;
};
declare const __VLS_base: import('vue').DefineComponent<ConfirmProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<ConfirmProps> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};

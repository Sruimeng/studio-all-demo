import { ToasterProps } from 'vue-sonner';
import { Classed } from '../../type';
type __VLS_Props = Omit<ToasterProps, 'offset' | 'mobile-offset' | 'mobileOffset' | 'toastOptions'> & Classed;
declare var __VLS_8: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_8) => any;
};
declare const __VLS_base: import('vue').DefineComponent<__VLS_Props, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};

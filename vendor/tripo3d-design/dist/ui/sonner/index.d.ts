import { toast } from 'vue-sonner';
import { default as Toaster } from './index.vue';
export { toast, Toaster };
declare const _default: {
    components: {
        Toaster: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<Omit<import('vue-sonner').ToasterProps, "offset" | "mobile-offset" | "mobileOffset" | "toastOptions"> & import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {
                position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<Omit<import('vue-sonner').ToasterProps, "offset" | "mobile-offset" | "mobileOffset" | "toastOptions"> & import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, {
                position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<Omit<import('vue-sonner').ToasterProps, "offset" | "mobile-offset" | "mobileOffset" | "toastOptions"> & import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {
            position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
    };
    helpers: {
        toast: ((message: string | import('vue').Component | (() => string | import('vue').Component), data?: import('vue-sonner').ExternalToast) => string | number) & {
            success: (message: string | import('vue').Component | (() => string | import('vue').Component), data?: import('vue-sonner').ExternalToast) => string | number;
            info: (message: string | import('vue').Component | (() => string | import('vue').Component), data?: import('vue-sonner').ExternalToast) => string | number;
            warning: (message: string | import('vue').Component | (() => string | import('vue').Component), data?: import('vue-sonner').ExternalToast) => string | number;
            error: (message: string | import('vue').Component | (() => string | import('vue').Component), data?: import('vue-sonner').ExternalToast) => string | number;
            custom: (component: import('vue').Component, data?: import('vue-sonner').ExternalToast) => string | number;
            message: (message: string | import('vue').Component | (() => string | import('vue').Component), data?: import('vue-sonner').ExternalToast) => string | number;
            promise: <ToastData>(promise: Promise<ToastData> | (() => Promise<ToastData>), data?: ({
                duration?: number | undefined;
                invert?: boolean | undefined;
                position?: ("top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center") | undefined;
                class?: string | undefined;
                style?: import('vue').CSSProperties | undefined;
                icon?: import('vue').Component | undefined;
                id?: number | string | undefined;
                component?: import('vue').Component | undefined;
                cancel?: (import('vue-sonner').Action | import('vue').Component) | undefined;
                dismissible?: boolean | undefined;
                closeButtonPosition?: ("top-left" | "top-right" | "bottom-left" | "bottom-right") | undefined;
                richColors?: boolean | undefined;
                closeButton?: boolean | undefined;
                unstyled?: boolean | undefined;
                toasterId?: string | undefined;
                componentProps?: any;
                important?: boolean | undefined;
                action?: (import('vue-sonner').Action | import('vue').Component) | undefined;
                onDismiss?: ((toast: import('vue-sonner').ToastT) => void) | undefined;
                onAutoClose?: ((toast: import('vue-sonner').ToastT) => void) | undefined;
                cancelButtonStyle?: import('vue').CSSProperties | undefined;
                actionButtonStyle?: import('vue').CSSProperties | undefined;
                classes?: import('vue-sonner').ToastClasses | undefined;
                descriptionClass?: string | undefined;
                testId?: string | undefined;
            } & {
                loading?: string | import('vue').Component;
                success?: (string | import('vue').Component | ((data: ToastData) => import('vue').Component | string | Promise<import('vue').Component | string>)) | (import('vue-sonner').PromiseIExtendedResult | ((data: ToastData) => import('vue-sonner').PromiseIExtendedResult | Promise<import('vue-sonner').PromiseIExtendedResult>)) | undefined;
                error?: (string | import('vue').Component | ((data: any) => import('vue').Component | string | Promise<import('vue').Component | string>)) | (import('vue-sonner').PromiseIExtendedResult | ((data: any) => import('vue-sonner').PromiseIExtendedResult | Promise<import('vue-sonner').PromiseIExtendedResult>));
                description?: string | import('vue').Component | ((data: any) => import('vue').Component | string | Promise<import('vue').Component | string>);
                finally?: () => void | Promise<void>;
            }) | undefined) => (string & {
                unwrap: () => Promise<ToastData>;
            }) | (number & {
                unwrap: () => Promise<ToastData>;
            }) | {
                unwrap: () => Promise<ToastData>;
            } | undefined;
            dismiss: (id?: number | string) => string | number | undefined;
            loading: (message: string | import('vue').Component | (() => string | import('vue').Component), data?: import('vue-sonner').ExternalToast) => string | number;
        } & {
            getHistory: () => (import('vue-sonner').ToastT<import('vue').Component> | import('vue-sonner').ToastToDismiss)[];
            getToasts: () => (import('vue-sonner').ToastT<import('vue').Component> | import('vue-sonner').ToastToDismiss)[];
        };
    };
};
export default _default;

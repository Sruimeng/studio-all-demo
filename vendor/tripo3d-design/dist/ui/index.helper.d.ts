declare const _default: {
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
    float: {
        close: (key: string) => void;
        show: <T extends import('vue').Component>(float: T, params?: import('vue-component-type-helpers').ComponentProps<T>, key?: string) => string;
        update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
    };
    useFloat: () => import('./float').FloatContext;
    dialog: {
        close: (key: string) => void;
        show: <T extends import('vue').Component>(dialog: T, params?: import('vue-component-type-helpers').ComponentProps<T>, key?: string) => string;
        update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
    };
    useDialog: () => import('./dialog/utils').DialogContext;
    CarouselPlugin: {
        Autoplay: typeof import('embla-carousel-autoplay').default;
    };
    useCarousel: typeof import('./carousel').useCarousel;
};
export default _default;

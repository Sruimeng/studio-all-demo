declare const _default: {
    loading: {
        close: (key: string) => void;
        show: <T extends import('vue').Component>(dialog?: T, params?: import('vue-component-type-helpers').ComponentProps<T>) => string;
        update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
    };
    imgViewer: import('./img-viewer').ImgViewerApi;
};
export default _default;

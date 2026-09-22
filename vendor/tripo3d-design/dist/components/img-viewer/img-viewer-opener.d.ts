import { ComputedRef } from 'vue';
export type ImgViewerSrc = string | File;
export interface ImgViewerShowOptions {
    initialIndex?: number;
    initialPosition?: {
        x?: number;
        y?: number;
    };
    onClose?: () => void;
    resizable?: boolean;
    target?: ImgViewerSrc;
}
interface ImgViewerState {
    images: ImgViewerSrc[];
    index: number;
    objectUrls: string[];
    onClose: (() => void) | null;
    resolved: string[];
    token: symbol | null;
}
export interface ImgViewerApi {
    close: () => void;
    readonly currentImage: ComputedRef<string | null>;
    readonly currentIndex: ComputedRef<number>;
    readonly isOpen: ComputedRef<boolean>;
    show: (src: ImgViewerSrc | ImgViewerSrc[], options?: ImgViewerShowOptions) => () => void;
}
export declare const imgViewer: ImgViewerApi;
export declare function _useImagePreviewerInternal(): {
    setIndex: (i: number) => void;
    state: import('vue').ShallowReactive<ImgViewerState>;
};
export {};

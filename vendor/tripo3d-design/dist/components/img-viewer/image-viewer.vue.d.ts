import { Classed } from '../../type';
export interface ImageViewerProps {
    defaultPosition?: 'center' | {
        x?: number;
        y?: number;
    };
    imageSize?: number;
    open?: boolean;
    opener?: string;
    resizable?: boolean;
    width?: number;
}
type __VLS_Props = ImageViewerProps & Classed;
declare const __VLS_export: import('vue').DefineComponent<__VLS_Props, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    open: boolean;
    opener: string;
    defaultPosition: "center" | {
        x?: number;
        y?: number;
    };
    width: number;
    imageSize: number;
    resizable: boolean;
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;

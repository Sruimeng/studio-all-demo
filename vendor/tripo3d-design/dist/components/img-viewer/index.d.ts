import { default as ImgViewerDelete } from './img-viewer-delete.vue';
import { imgViewer } from './img-viewer-opener';
import { default as ImgViewer } from './img-viewer.vue';
export type { ImgViewerApi, ImgViewerShowOptions, ImgViewerSrc } from './img-viewer-opener';
export { imgViewer, ImgViewer, ImgViewerDelete };
declare const _default: {
    components: {
        ImgViewer: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../../type').Classed & {
                alt?: string;
                loading?: "lazy" | "eager";
                src: import('./helper').ImgSource | import('./helper').ImgSource[];
            }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('../../type').Classed & {
                alt?: string;
                loading?: "lazy" | "eager";
                src: import('./helper').ImgSource | import('./helper').ImgSource[];
            }> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('../../type').Classed & {
            alt?: string;
            loading?: "lazy" | "eager";
            src: import('./helper').ImgSource | import('./helper').ImgSource[];
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        ImgViewerDelete: import('vue').DefineComponent<import('../../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    };
    helpers: {
        imgViewer: import('./img-viewer-opener').ImgViewerApi;
    };
};
export default _default;

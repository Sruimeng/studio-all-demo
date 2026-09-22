import { default as ScrollArea } from './scroll-area.vue';
import { default as ScrollBar } from './scroll-bar.vue';
export { ScrollArea, ScrollBar };
declare const _default: {
    components: {
        ScrollArea: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').ScrollAreaRootProps & import('../../type').Classed & {
                viewportClass?: string;
            }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').ScrollAreaRootProps & import('../../type').Classed & {
                viewportClass?: string;
            }> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').ScrollAreaRootProps & import('../../type').Classed & {
            viewportClass?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        ScrollBar: import('vue').DefineComponent<import('reka-ui').ScrollAreaScrollbarProps & import('../../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<import('reka-ui').ScrollAreaScrollbarProps & import('../../type').Classed> & Readonly<{}>, {
            orientation: "vertical" | "horizontal";
        }, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    };
};
export default _default;

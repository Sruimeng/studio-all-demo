import { default as Button } from './button.vue';
export * from './type';
export { Button };
declare const _default: {
    components: {
        Button: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('./type').ButtonProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {
                as: import('reka-ui').AsTag;
                variant: "default" | "border" | "custom";
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('./type').ButtonProps> & Readonly<{}>, {}, {}, {}, {}, {
                as: import('reka-ui').AsTag;
                variant: "default" | "border" | "custom";
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('./type').ButtonProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {
            as: import('reka-ui').AsTag;
            variant: "default" | "border" | "custom";
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
    };
};
export default _default;

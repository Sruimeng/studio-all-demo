import { default as GuideTrigger } from './guide-trigger.vue';
import { default as GuideContent } from './guide-content.vue';
import { default as GuideAnchor } from './guide-anchor.vue';
import { default as Guide } from './guide.vue';
export { Guide, GuideAnchor, GuideContent, GuideTrigger };
declare const _default: {
    components: {
        Guide: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../..').TooltipProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:open": (value: boolean) => any;
            }, import('vue').PublicProps, {
                delayDuration: number;
                touchable: boolean;
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('../..').TooltipProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, {
                delayDuration: number;
                touchable: boolean;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('../..').TooltipProps> & Readonly<{
            "onUpdate:open"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:open": (value: boolean) => any;
        }, string, {
            delayDuration: number;
            touchable: boolean;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        GuideAnchor: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, true, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        GuideContent: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').TooltipContentProps & import('../../type').Classed & {
                alt?: string;
                description?: string;
                img?: string;
                title?: string;
            }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {
                side: "bottom" | "left" | "right" | "top";
                sideOffset: number;
                avoidCollisions: boolean;
                collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').TooltipContentProps & import('../../type').Classed & {
                alt?: string;
                description?: string;
                img?: string;
                title?: string;
            }> & Readonly<{}>, {}, {}, {}, {}, {
                side: "bottom" | "left" | "right" | "top";
                sideOffset: number;
                avoidCollisions: boolean;
                collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').TooltipContentProps & import('../../type').Classed & {
            alt?: string;
            description?: string;
            img?: string;
            title?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {
            side: "bottom" | "left" | "right" | "top";
            sideOffset: number;
            avoidCollisions: boolean;
            collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            } & {
                img?: (props: {}) => any;
            } & {
                title?: (props: {}) => any;
            } & {
                description?: (props: {}) => any;
            };
        });
        GuideTrigger: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{
                as?: (import('reka-ui').AsTag | import('vue').Component) | undefined;
                asChild?: boolean | undefined;
            }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<{
                as?: (import('reka-ui').AsTag | import('vue').Component) | undefined;
                asChild?: boolean | undefined;
            }> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<{
            as?: (import('reka-ui').AsTag | import('vue').Component) | undefined;
            asChild?: boolean | undefined;
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
    };
};
export default _default;

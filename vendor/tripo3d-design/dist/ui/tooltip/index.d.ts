import { default as TooltipContent } from './tooltip-content.vue';
import { default as TooltipTrigger } from './tooltip-trigger.vue';
import { default as Tooltip } from './tooltip.vue';
export { Tooltip, TooltipContent, TooltipTrigger };
export type { TooltipProps } from './tooltip.vue';
declare const _default: {
    components: {
        Tooltip: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('./tooltip.vue').TooltipProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:open": (value: boolean) => any;
            }, import('vue').PublicProps, {
                delayDuration: number;
                ignoreNonKeyboardFocus: boolean;
                touchable: boolean;
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('./tooltip.vue').TooltipProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, {
                delayDuration: number;
                ignoreNonKeyboardFocus: boolean;
                touchable: boolean;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('./tooltip.vue').TooltipProps> & Readonly<{
            "onUpdate:open"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:open": (value: boolean) => any;
        }, string, {
            delayDuration: number;
            ignoreNonKeyboardFocus: boolean;
            touchable: boolean;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            } & {
                default?: (props: {}) => any;
            };
        });
        TooltipContent: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').TooltipContentProps & import('../../type').Classed> & Readonly<{
                onEscapeKeyDown?: ((event: KeyboardEvent) => any) | undefined;
                onPointerDownOutside?: ((event: Event) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                escapeKeyDown: (event: KeyboardEvent) => any;
                pointerDownOutside: (event: Event) => any;
            }, import('vue').PublicProps, {
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
            }, Readonly<import('reka-ui').TooltipContentProps & import('../../type').Classed> & Readonly<{
                onEscapeKeyDown?: ((event: KeyboardEvent) => any) | undefined;
                onPointerDownOutside?: ((event: Event) => any) | undefined;
            }>, {}, {}, {}, {}, {
                side: "bottom" | "left" | "right" | "top";
                sideOffset: number;
                avoidCollisions: boolean;
                collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').TooltipContentProps & import('../../type').Classed> & Readonly<{
            onEscapeKeyDown?: ((event: KeyboardEvent) => any) | undefined;
            onPointerDownOutside?: ((event: Event) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            escapeKeyDown: (event: KeyboardEvent) => any;
            pointerDownOutside: (event: Event) => any;
        }, string, {
            side: "bottom" | "left" | "right" | "top";
            sideOffset: number;
            avoidCollisions: boolean;
            collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        TooltipTrigger: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').TooltipTriggerProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').TooltipTriggerProps> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').TooltipTriggerProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
    };
};
export default _default;

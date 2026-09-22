import { FloatOpener } from './float-opener';
import { useFloat } from './utils';
import { default as Float } from './float.vue';
export * from './type';
declare const float: {
    close: (key: string) => void;
    show: <T extends import('vue').Component>(float: T, params?: import('vue-component-type-helpers').ComponentProps<T>, key?: string) => string;
    update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
};
export { Float, float, FloatOpener, useFloat, };
declare const _default: {
    components: {
        Float: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('./type').FloatProps & {
                open?: boolean;
            }> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:open": (value: boolean) => any;
            }, import('vue').PublicProps, {
                opener: string;
                defaultPosition: "center" | {
                    x?: number;
                    y?: number;
                };
                width: number;
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('./type').FloatProps & {
                open?: boolean;
            }> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, {
                opener: string;
                defaultPosition: "center" | {
                    x?: number;
                    y?: number;
                };
                width: number;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('./type').FloatProps & {
            open?: boolean;
        }> & Readonly<{
            "onUpdate:open"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:open": (value: boolean) => any;
        }, string, {
            opener: string;
            defaultPosition: "center" | {
                x?: number;
                y?: number;
            };
            width: number;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: () => any;
                header?: () => any;
                title?: () => any;
            };
        });
        FloatOpener: import('vue').DefineComponent<{}, () => import('vue').VNode<import('vue').RendererNode, import('vue').RendererElement, {
            [key: string]: any;
        }>[], {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, true, {}, any>;
    };
    helpers: {
        float: {
            close: (key: string) => void;
            show: <T extends import('vue').Component>(float: T, params?: import('vue-component-type-helpers').ComponentProps<T>, key?: string) => string;
            update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
        };
        useFloat: () => import('./utils').FloatContext;
    };
};
export default _default;

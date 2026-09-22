import { default as LoadingIcon } from './loading-icon.vue';
import { default as Loading } from './loading.vue';
declare const loading: {
    close: (key: string) => void;
    show: <T extends import('vue').Component>(dialog?: T, params?: import('vue-component-type-helpers').ComponentProps<T>) => string;
    update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
};
export { Loading, loading, LoadingIcon };
declare const _default: {
    components: {
        Loading: {
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
        LoadingIcon: import('vue').DefineComponent<{
            gap?: number;
            monochrome?: boolean;
            size?: number;
        } & import('../../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<{
            gap?: number;
            monochrome?: boolean;
            size?: number;
        } & import('../../type').Classed> & Readonly<{}>, {
            gap: number;
            size: number;
            monochrome: boolean;
        }, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    };
    helpers: {
        loading: {
            close: (key: string) => void;
            show: <T extends import('vue').Component>(dialog?: T, params?: import('vue-component-type-helpers').ComponentProps<T>) => string;
            update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
        };
    };
};
export default _default;

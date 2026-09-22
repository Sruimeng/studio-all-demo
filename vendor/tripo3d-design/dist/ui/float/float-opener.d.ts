import { ComponentProps } from 'vue-component-type-helpers';
import { Component, ShallowReactive } from 'vue';
declare const Data: unique symbol;
export interface FloatData {
    [key: string]: {
        float: Component;
        params: any;
    };
}
declare global {
    interface Window {
        [Data]?: ShallowReactive<FloatData>;
    }
}
export declare const FloatOpener: import('vue').DefineComponent<{}, () => import('vue').VNode<import('vue').RendererNode, import('vue').RendererElement, {
    [key: string]: any;
}>[], {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, true, {}, any>;
export declare const show: <T extends Component>(float: T, params?: ComponentProps<T>, key?: string) => string;
export declare const update: <T extends Component>(key: string, newParams?: ComponentProps<T>) => void;
export declare const close: (key: string) => void;
export {};

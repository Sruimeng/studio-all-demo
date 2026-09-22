import { ComponentProps } from 'vue-component-type-helpers';
import { Component } from 'vue';
export declare const show: <T extends Component>(dialog?: T, params?: ComponentProps<T>) => string;
export declare const update: <T extends Component>(key: string, newParams?: ComponentProps<T>) => void;
export declare const close: (key: string) => void;

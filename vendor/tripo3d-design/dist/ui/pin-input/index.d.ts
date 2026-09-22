import { default as PinInputInput } from './pin-input-input.vue';
import { default as PinInputRoot } from './pin-input-root.vue';
export { PinInputInput, PinInputRoot };
declare const _default: {
    components: {
        PinInputInput: import('vue').DefineComponent<import('reka-ui').PinInputInputProps & import('../../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<import('reka-ui').PinInputInputProps & import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
        PinInputRoot: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').PinInputRootProps<"text"> & import('../../type').Classed> & Readonly<{
                "onUpdate:modelValue"?: ((value: string[]) => any) | undefined;
                onComplete?: ((value: string[]) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:modelValue": (value: string[]) => any;
                complete: (value: string[]) => any;
            }, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').PinInputRootProps<"text"> & import('../../type').Classed> & Readonly<{
                "onUpdate:modelValue"?: ((value: string[]) => any) | undefined;
                onComplete?: ((value: string[]) => any) | undefined;
            }>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').PinInputRootProps<"text"> & import('../../type').Classed> & Readonly<{
            "onUpdate:modelValue"?: ((value: string[]) => any) | undefined;
            onComplete?: ((value: string[]) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:modelValue": (value: string[]) => any;
            complete: (value: string[]) => any;
        }, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
    };
};
export default _default;

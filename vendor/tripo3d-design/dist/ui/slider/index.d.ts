import { default as Slider } from './slider.vue';
export { Slider };
declare const _default: {
    components: {
        Slider: import('vue').DefineComponent<import('reka-ui').SliderRootProps & import('../../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:modelValue": (payload: number[] | undefined) => any;
            valueCommit: (payload: number[]) => any;
        }, string, import('vue').PublicProps, Readonly<import('reka-ui').SliderRootProps & import('../../type').Classed> & Readonly<{
            "onUpdate:modelValue"?: ((payload: number[] | undefined) => any) | undefined;
            onValueCommit?: ((payload: number[]) => any) | undefined;
        }>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    };
};
export default _default;

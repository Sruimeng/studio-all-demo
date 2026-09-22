import { default as InputSlider } from './input-slider.vue';
export { InputSlider };
declare const _default: {
    components: {
        InputSlider: import('vue').DefineComponent<import('../../type').Classed & import('reka-ui').SliderRootProps & {
            inputClass?: string;
            showAuto?: boolean;
            textAuto?: string;
        }, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:modelValue": (payload: number[] | undefined) => any;
            valueCommit: (payload: number[]) => any;
        }, string, import('vue').PublicProps, Readonly<import('../../type').Classed & import('reka-ui').SliderRootProps & {
            inputClass?: string;
            showAuto?: boolean;
            textAuto?: string;
        }> & Readonly<{
            "onUpdate:modelValue"?: ((payload: number[] | undefined) => any) | undefined;
            onValueCommit?: ((payload: number[]) => any) | undefined;
        }>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    };
};
export default _default;

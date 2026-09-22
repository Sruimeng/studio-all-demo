import { SliderRootProps } from 'reka-ui';
import { Classed } from '../../type';
type SliderProps = Classed & SliderRootProps & {
    inputClass?: string;
    showAuto?: boolean;
    textAuto?: string;
};
declare const __VLS_export: import('vue').DefineComponent<SliderProps, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
    "update:modelValue": (payload: number[] | undefined) => any;
    valueCommit: (payload: number[]) => any;
}, string, import('vue').PublicProps, Readonly<SliderProps> & Readonly<{
    "onUpdate:modelValue"?: ((payload: number[] | undefined) => any) | undefined;
    onValueCommit?: ((payload: number[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;

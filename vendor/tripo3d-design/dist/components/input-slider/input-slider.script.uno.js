import { cn } from "../../utils/config.js";
import slider_default from "../../ui/slider/slider.uno.js";
import snap_input_default from "../snap-input/snap-input.uno.js";
import { computed, createElementBlock, createPropsRestProxy, createVNode, defineComponent, mergeProps, normalizeClass, openBlock, unref } from "vue";
import { useForwardPropsEmits } from "reka-ui";
//#region src/components/input-slider/input-slider.vue?vue&type=script&setup=true&lang.ts
var input_slider_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "input-slider",
	props: {
		class: {},
		defaultValue: {},
		modelValue: {},
		disabled: { type: Boolean },
		orientation: {},
		dir: {},
		inverted: { type: Boolean },
		min: { default: 0 },
		max: { default: 100 },
		step: {},
		minStepsBetweenThumbs: {},
		thumbAlignment: {},
		asChild: { type: Boolean },
		as: {},
		name: {},
		required: { type: Boolean },
		inputClass: {},
		showAuto: { type: Boolean },
		textAuto: {}
	},
	emits: ["update:modelValue", "valueCommit"],
	setup(__props, { emit: __emit }) {
		const other = createPropsRestProxy(__props, [
			"class",
			"disabled",
			"inputClass",
			"max",
			"min",
			"modelValue",
			"showAuto",
			"textAuto"
		]);
		const emits = __emit;
		const forwarded = useForwardPropsEmits(other, emits);
		const displayValue = computed(() => {
			if (!__props.modelValue) return "";
			if (__props.modelValue[0] === __props.min && __props.showAuto) return __props.textAuto ?? "Auto";
			else return String(__props.modelValue[0]);
		});
		const handleInputChange = (value) => {
			const numValue = Number(value);
			if (isNaN(numValue)) return;
			const clampedValue = Math.max(__props.min, Math.min(__props.max, numValue));
			emits("update:modelValue", [clampedValue]);
		};
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", { class: normalizeClass(["flex gap-2 items-center", __props.disabled && "opacity-50"]) }, [createVNode(unref(slider_default), mergeProps({
				max: __props.max,
				min: __props.min,
				class: __props.class,
				disabled: __props.disabled,
				"model-value": __props.modelValue
			}, unref(forwarded)), null, 16, [
				"max",
				"min",
				"class",
				"disabled",
				"model-value"
			]), createVNode(unref(snap_input_default), {
				type: "text",
				disabled: __props.disabled,
				value: displayValue.value,
				class: normalizeClass(unref(cn)("w-18.5 border border-white-10 rounded-2 bg-transparent py-2 text-center text-3", __props.inputClass)),
				onChange: handleInputChange
			}, null, 8, [
				"disabled",
				"value",
				"class"
			])], 2);
		};
	}
});
//#endregion
export { input_slider_vue_vue_type_script_setup_true_lang_default as default };

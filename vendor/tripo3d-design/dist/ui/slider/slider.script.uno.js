import { cn } from "../../utils/config.js";
import { Fragment, createBlock, createElementBlock, createPropsRestProxy, createVNode, defineComponent, mergeProps, openBlock, renderList, unref, withCtx } from "vue";
import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from "reka-ui";
//#region src/ui/slider/slider.vue?vue&type=script&setup=true&lang.ts
var slider_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "slider",
	props: {
		defaultValue: {},
		modelValue: {},
		disabled: { type: Boolean },
		orientation: {},
		dir: {},
		inverted: { type: Boolean },
		min: {},
		max: {},
		step: {},
		minStepsBetweenThumbs: {},
		thumbAlignment: {},
		asChild: { type: Boolean },
		as: {},
		name: {},
		required: { type: Boolean },
		class: {}
	},
	emits: ["update:modelValue", "valueCommit"],
	setup(__props, { emit: __emit }) {
		const other = createPropsRestProxy(__props, ["class"]);
		const forwarded = useForwardPropsEmits(other, __emit);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(SliderRoot), mergeProps({ class: unref(cn)("relative flex touch-none select-none items-center", __props.class) }, unref(forwarded)), {
				default: withCtx(() => [createVNode(unref(SliderTrack), { class: "rounded-full bg-white-5 grow h-1 w-full relative overflow-hidden" }, {
					default: withCtx(() => [createVNode(unref(SliderRange), { class: "bg-white-80 h-full absolute" })]),
					_: 1
				}), (openBlock(true), createElementBlock(Fragment, null, renderList(__props.modelValue, (_, key) => {
					return openBlock(), createBlock(unref(SliderThumb), {
						key,
						class: "border-2 border-white rounded-full bg-black size-3.75 block cursor-pointer transition focus-visible:outline-none"
					});
				}), 128))]),
				_: 1
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { slider_vue_vue_type_script_setup_true_lang_default as default };

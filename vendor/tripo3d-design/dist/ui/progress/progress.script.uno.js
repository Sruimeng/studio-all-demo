import { cn } from "../../utils/config.js";
import { createBlock, createVNode, defineComponent, mergeProps, normalizeClass, normalizeStyle, openBlock, unref, withCtx } from "vue";
import { ProgressIndicator, ProgressRoot } from "reka-ui";
//#region src/ui/progress/progress.vue?vue&type=script&setup=true&lang.ts
var progress_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "progress",
	props: {
		modelValue: { default: 0 },
		max: {},
		getValueLabel: {},
		getValueText: {},
		asChild: { type: Boolean },
		as: {},
		class: {},
		indicator: {}
	},
	setup(__props) {
		const props = __props;
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(ProgressRoot), mergeProps(props, { class: unref(cn)("relative w-full mb-2 overflow-hidden rounded-full bg-white-10 h-1", props.class) }), {
				default: withCtx(() => [createVNode(unref(ProgressIndicator), {
					style: normalizeStyle(`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`),
					class: normalizeClass(unref(cn)("bg-gray-200 flex-1 size-full transition-all", props.indicator))
				}, null, 8, ["style", "class"])]),
				_: 1
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { progress_vue_vue_type_script_setup_true_lang_default as default };

import { cn } from "../../utils/config.js";
import icon_default from "../icon/icon.uno.js";
import { createBlock, createVNode, defineComponent, mergeProps, normalizeClass, openBlock, renderSlot, unref, withCtx } from "vue";
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui";
//#region src/ui/checkbox/checkbox.vue?vue&type=script&setup=true&lang.ts
var BaseStyle = "border border-white rounded-1/2 border-solid size-5 transition box-border";
var CheckedStyle = "data-[state=checked]:c-white data-[state=checked]:bg-purple-1";
var checkbox_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "checkbox",
	props: {
		defaultValue: {},
		modelValue: {},
		disabled: { type: Boolean },
		value: {},
		id: {},
		trueValue: {},
		falseValue: {},
		asChild: { type: Boolean },
		as: {},
		name: {},
		required: { type: Boolean },
		class: {}
	},
	emits: ["update:modelValue"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const forwarded = useForwardPropsEmits(props, __emit);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(CheckboxRoot), mergeProps({ class: unref(cn)(BaseStyle, CheckedStyle, props.class) }, unref(forwarded)), {
				default: withCtx(() => [createVNode(unref(CheckboxIndicator), { class: normalizeClass(unref(cn)("flex items-center justify-center size-full")) }, {
					default: withCtx(() => [renderSlot(_ctx.$slots, "default", {}, () => [createVNode(icon_default, {
						icon: "i-tripo:check",
						class: "c-white size-full"
					})])]),
					_: 3
				}, 8, ["class"])]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { checkbox_vue_vue_type_script_setup_true_lang_default as default };

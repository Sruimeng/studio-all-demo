import { cn } from "../../utils/config.js";
import { createBlock, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from "reka-ui";
//#region src/ui/switch/switch.vue?vue&type=script&setup=true&lang.ts
var BaseStyle = "group border border-white-10 rounded-full flex h-4.5 w-8.5 cursor-pointer items-center";
var ActiveStyle = "data-[state=checked]:border-purple-1 data-[state=checked]:bg-purple-1 data-[state=checked]:hover:bg-purple-60";
var switch_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "switch",
	props: {
		defaultValue: {},
		modelValue: {},
		disabled: { type: Boolean },
		id: {},
		value: {},
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
			return openBlock(), createBlock(unref(SwitchRoot), mergeProps(unref(forwarded), { class: unref(cn)(BaseStyle, ActiveStyle, props.class) }), {
				default: withCtx(() => [createVNode(unref(SwitchThumb), { class: "rounded-full bg-gray-400 size-3 block transition-transform data-[state=checked]:bg-white group-hover:bg-white data-[state=checked]:translate-x-4.5 data-[state=unchecked]:translate-x-0.5 data-[state=checked]:group-hover:bg-gray-300" }, {
					default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
					_: 3
				})]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { switch_vue_vue_type_script_setup_true_lang_default as default };

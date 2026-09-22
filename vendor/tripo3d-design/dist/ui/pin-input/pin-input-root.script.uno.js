import { cn } from "../../utils/config.js";
import { createBlock, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { PinInputRoot, useForwardPropsEmits } from "reka-ui";
//#region src/ui/pin-input/pin-input-root.vue?vue&type=script&setup=true&lang.ts
var pin_input_root_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "pin-input-root",
	props: {
		modelValue: {},
		defaultValue: {},
		placeholder: {},
		mask: { type: Boolean },
		otp: { type: Boolean },
		type: {},
		dir: {},
		disabled: { type: Boolean },
		id: {},
		asChild: { type: Boolean },
		as: {},
		name: {},
		required: { type: Boolean },
		class: {}
	},
	emits: ["update:modelValue", "complete"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const forwarded = useForwardPropsEmits(props, __emit);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(PinInputRoot), mergeProps(unref(forwarded), { class: unref(cn)("mt-1 flex gap-2 items-center", props.class) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { pin_input_root_vue_vue_type_script_setup_true_lang_default as default };

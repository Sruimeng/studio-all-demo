import { cn } from "../../utils/config.js";
import { createBlock, defineComponent, guardReactiveProps, mergeProps, normalizeProps, openBlock, provide, renderSlot, unref, withCtx } from "vue";
import { ToggleGroupRoot, useForwardPropsEmits } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
//#region src/ui/toggle/toggle-group.vue?vue&type=script&setup=true&lang.ts
var toggle_group_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "toggle-group",
	props: {
		rovingFocus: { type: Boolean },
		disabled: { type: Boolean },
		orientation: {},
		dir: {},
		loop: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
		name: {},
		required: { type: Boolean },
		type: {},
		modelValue: {},
		defaultValue: {},
		class: {},
		variant: {}
	},
	emits: ["update:modelValue"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emits = __emit;
		provide("toggleGroup", { variant: props.variant });
		const delegatedProps = reactiveOmit(props, "class");
		const forwarded = useForwardPropsEmits(delegatedProps, emits);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(ToggleGroupRoot), mergeProps(unref(forwarded), { class: unref(cn)("flex items-center justify-center gap-1", props.class) }), {
				default: withCtx((slotProps) => [renderSlot(_ctx.$slots, "default", normalizeProps(guardReactiveProps(slotProps)))]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { toggle_group_vue_vue_type_script_setup_true_lang_default as default };

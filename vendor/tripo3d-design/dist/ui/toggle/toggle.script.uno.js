import { cn } from "../../utils/config.js";
import { BaseStyle, ButtonStyle, NavigationStyle, iconClassName } from "./style.uno.js";
import { computed, createBlock, defineComponent, guardReactiveProps, mergeProps, normalizeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { Toggle, useForwardPropsEmits } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
//#region src/ui/toggle/toggle.vue?vue&type=script&setup=true&lang.ts
var toggle_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "toggle",
	props: {
		defaultValue: { type: Boolean },
		modelValue: { type: [Boolean, null] },
		disabled: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
		name: {},
		required: { type: Boolean },
		class: {},
		variant: {}
	},
	emits: ["update:modelValue"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const variantStyle = computed(() => {
			if (props.variant === "button") return ButtonStyle;
			if (props.variant === "navigation") return NavigationStyle;
			if (props.variant === "icon") return iconClassName;
			return "";
		});
		const emits = __emit;
		const delegatedProps = reactiveOmit(props, "class");
		const forwarded = useForwardPropsEmits(delegatedProps, emits);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(Toggle), mergeProps(unref(forwarded), { class: unref(cn)(unref(BaseStyle), variantStyle.value, props.class) }), {
				default: withCtx((slotProps) => [renderSlot(_ctx.$slots, "default", normalizeProps(guardReactiveProps(slotProps)))]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { toggle_vue_vue_type_script_setup_true_lang_default as default };

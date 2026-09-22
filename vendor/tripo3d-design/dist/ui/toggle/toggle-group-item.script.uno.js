import { cn } from "../../utils/config.js";
import { BaseStyle, ButtonStyle, NavigationStyle, iconClassName } from "./style.uno.js";
import { computed, createBlock, defineComponent, guardReactiveProps, inject, mergeProps, normalizeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { ToggleGroupItem, useForwardProps } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
//#region src/ui/toggle/toggle-group-item.vue?vue&type=script&setup=true&lang.ts
var toggle_group_item_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "toggle-group-item",
	props: {
		value: {},
		disabled: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
		class: {},
		variant: {}
	},
	setup(__props) {
		const props = __props;
		const context = inject("toggleGroup");
		const variantStyle = computed(() => {
			const variant = context?.variant || props.variant;
			if (variant === "button") return ButtonStyle;
			if (variant === "navigation") return NavigationStyle;
			if (variant === "icon") return iconClassName;
			return "";
		});
		const delegatedProps = reactiveOmit(props, "class", "variant");
		const forwardedProps = useForwardProps(delegatedProps);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(ToggleGroupItem), mergeProps(unref(forwardedProps), { class: unref(cn)(unref(BaseStyle), variantStyle.value, props.class) }), {
				default: withCtx((slotProps) => [renderSlot(_ctx.$slots, "default", normalizeProps(guardReactiveProps(slotProps)))]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { toggle_group_item_vue_vue_type_script_setup_true_lang_default as default };

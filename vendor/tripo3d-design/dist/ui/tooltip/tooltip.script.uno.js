import tooltip_touch_root_default from "./tooltip-touch-root.uno.js";
import { createBlock, defineComponent, mergeProps, normalizeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { TooltipProvider, TooltipRoot, useForwardPropsEmits } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
//#region src/ui/tooltip/tooltip.vue?vue&type=script&setup=true&lang.ts
var tooltip_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "tooltip",
	props: {
		touchable: {
			type: Boolean,
			default: false
		},
		defaultOpen: { type: Boolean },
		open: { type: Boolean },
		delayDuration: { default: 0 },
		disableHoverableContent: { type: Boolean },
		disableClosingTrigger: { type: Boolean },
		disabled: { type: Boolean },
		ignoreNonKeyboardFocus: {
			type: Boolean,
			default: true
		}
	},
	emits: ["update:open"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emits = __emit;
		const delegatedProps = reactiveOmit(props, "touchable");
		const forwarded = useForwardPropsEmits(delegatedProps, emits);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(TooltipProvider), null, {
				default: withCtx(() => [__props.touchable ? (openBlock(), createBlock(tooltip_touch_root_default, normalizeProps(mergeProps({ key: 0 }, unref(forwarded))), {
					default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
					_: 3
				}, 16)) : (openBlock(), createBlock(unref(TooltipRoot), normalizeProps(mergeProps({ key: 1 }, unref(forwarded))), {
					default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
					_: 3
				}, 16))]),
				_: 3
			});
		};
	}
});
//#endregion
export { tooltip_vue_vue_type_script_setup_true_lang_default as default };

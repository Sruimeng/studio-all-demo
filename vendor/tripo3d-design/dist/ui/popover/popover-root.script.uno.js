import { createBlock, defineComponent, guardReactiveProps, normalizeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { PopoverRoot, useForwardPropsEmits } from "reka-ui";
//#region src/ui/popover/popover-root.vue?vue&type=script&setup=true&lang.ts
var popover_root_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "popover-root",
	props: {
		defaultOpen: { type: Boolean },
		open: { type: Boolean },
		modal: { type: Boolean }
	},
	emits: ["update:open"],
	setup(__props, { emit: __emit }) {
		const forwarded = useForwardPropsEmits(__props, __emit);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(PopoverRoot), normalizeProps(guardReactiveProps(unref(forwarded))), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16);
		};
	}
});
//#endregion
export { popover_root_vue_vue_type_script_setup_true_lang_default as default };

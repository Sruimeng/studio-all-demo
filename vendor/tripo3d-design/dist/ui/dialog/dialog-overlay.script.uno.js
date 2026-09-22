import { cn } from "../../utils/config.js";
import { AnimationBaseStyle } from "./style.uno.js";
import { createBlock, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { DialogOverlay, useForwardProps } from "reka-ui";
//#region src/ui/dialog/dialog-overlay.vue?vue&type=script&setup=true&lang.ts
var dialog_overlay_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "dialog-overlay",
	props: {
		forceMount: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	setup(__props) {
		const props = __props;
		const forwarded = useForwardProps(props);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(DialogOverlay), mergeProps({ class: unref(cn)("bg-black-80 inset-0 fixed z-50", unref(AnimationBaseStyle), props.class) }, unref(forwarded)), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { dialog_overlay_vue_vue_type_script_setup_true_lang_default as default };

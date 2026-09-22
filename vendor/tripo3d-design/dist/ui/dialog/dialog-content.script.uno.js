import { cn } from "../../utils/config.js";
import { AnimationBaseStyle, ContentStyle } from "./style.uno.js";
import { createBlock, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { DialogContent, DialogTitle, VisuallyHidden, useForwardPropsEmits } from "reka-ui";
//#region src/ui/dialog/dialog-content.vue?vue&type=script&setup=true&lang.ts
var dialog_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "dialog-content",
	props: {
		forceMount: { type: Boolean },
		disableOutsidePointerEvents: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	emits: [
		"escapeKeyDown",
		"pointerDownOutside",
		"focusOutside",
		"interactOutside",
		"openAutoFocus",
		"closeAutoFocus"
	],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const forwarded = useForwardPropsEmits(props, __emit);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(DialogContent), mergeProps({
				"aria-describedby": void 0,
				class: unref(cn)(unref(ContentStyle), unref(AnimationBaseStyle), props.class)
			}, unref(forwarded)), {
				default: withCtx(() => [createVNode(unref(VisuallyHidden), { "as-child": "" }, {
					default: withCtx(() => [createVNode(unref(DialogTitle))]),
					_: 1
				}), renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { dialog_content_vue_vue_type_script_setup_true_lang_default as default };

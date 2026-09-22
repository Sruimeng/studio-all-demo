import dialog_content_default from "./dialog-content.uno.js";
import dialog_overlay_default from "./dialog-overlay.uno.js";
import { createDialogContext, useProvideDialog } from "./utils.js";
import { createBlock, createVNode, defineComponent, guardReactiveProps, normalizeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { DialogPortal, DialogRoot, useForwardPropsEmits } from "reka-ui";
//#region src/ui/dialog/dialog.vue?vue&type=script&setup=true&lang.ts
var dialog_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "dialog",
	props: {
		open: { type: Boolean },
		defaultOpen: { type: Boolean },
		modal: { type: Boolean },
		unmountOnHide: { type: Boolean },
		opener: { default: "" }
	},
	emits: ["update:open"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const forwarded = useForwardPropsEmits(props, __emit);
		useProvideDialog(createDialogContext(props.opener));
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(DialogRoot), normalizeProps(guardReactiveProps(unref(forwarded))), {
				default: withCtx(() => [createVNode(unref(DialogPortal), null, {
					default: withCtx(() => [createVNode(dialog_overlay_default), createVNode(dialog_content_default, null, {
						default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
						_: 3
					})]),
					_: 3
				})]),
				_: 3
			}, 16);
		};
	}
});
//#endregion
export { dialog_vue_vue_type_script_setup_true_lang_default as default };

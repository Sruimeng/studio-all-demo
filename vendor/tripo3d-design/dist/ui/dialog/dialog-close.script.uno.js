import { useDialog } from "./utils.js";
import { createBlock, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { Primitive } from "reka-ui";
//#region src/ui/dialog/dialog-close.vue?vue&type=script&setup=true&lang.ts
var dialog_close_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "dialog-close",
	props: {
		asChild: { type: Boolean },
		as: { default: "button" }
	},
	setup(__props) {
		const props = __props;
		const { close } = useDialog();
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(Primitive), mergeProps(props, {
				type: __props.as === "button" ? "button" : void 0,
				onClick: unref(close)
			}), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["type", "onClick"]);
		};
	}
});
//#endregion
export { dialog_close_vue_vue_type_script_setup_true_lang_default as default };

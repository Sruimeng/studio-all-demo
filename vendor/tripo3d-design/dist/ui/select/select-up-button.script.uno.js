import { cn } from "../../utils/config.js";
import icon_default from "../icon/icon.uno.js";
import { createBlock, createPropsRestProxy, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { SelectScrollUpButton } from "reka-ui";
//#region src/ui/select/select-up-button.vue?vue&type=script&setup=true&lang.ts
var select_up_button_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	name: "SelectUpButton",
	__name: "select-up-button",
	props: {
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, ["class"]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(SelectScrollUpButton), mergeProps(other, { class: unref(cn)("flex cursor-default items-center justify-center py-1", __props.class) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default", {}, () => [createVNode(unref(icon_default), { icon: "i-tripo:arrow" })])]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { select_up_button_vue_vue_type_script_setup_true_lang_default as default };

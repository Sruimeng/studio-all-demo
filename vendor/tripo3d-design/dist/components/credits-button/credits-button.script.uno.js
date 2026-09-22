import { cn } from "../../utils/config.js";
import button_default from "../../ui/button/button.uno.js";
import icon_default from "../../ui/icon/icon.uno.js";
import { createBlock, createCommentVNode, createElementBlock, createPropsRestProxy, createTextVNode, createVNode, defineComponent, mergeProps, normalizeClass, openBlock, renderSlot, toDisplayString, unref, withCtx } from "vue";
//#region src/components/credits-button/credits-button.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = {
	key: 1,
	class: "flex gap-1 items-center"
};
var credits_button_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "credits-button",
	props: {
		credits: {},
		iconClass: { default: "" },
		subscribe: { type: Boolean },
		class: {},
		as: {},
		backgroundClass: {},
		disabled: { type: Boolean },
		loading: { type: Boolean },
		variant: {},
		wrapperClass: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, [
			"class",
			"credits",
			"iconClass",
			"subscribe"
		]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(button_default), mergeProps(other, { class: unref(cn)("gap-1", __props.class) }), {
				default: withCtx(() => [
					__props.subscribe ? (openBlock(), createBlock(unref(icon_default), {
						key: 0,
						icon: "i-tripo:subscribe",
						class: normalizeClass(unref(cn)("size-5", __props.iconClass))
					}, null, 8, ["class"])) : createCommentVNode("", true),
					renderSlot(_ctx.$slots, "default"),
					__props.credits ? (openBlock(), createElementBlock("div", _hoisted_1, [createVNode(unref(icon_default), {
						icon: "i-tripo:bolt",
						class: normalizeClass(unref(cn)("size-5", __props.iconClass))
					}, null, 8, ["class"]), createTextVNode(" " + toDisplayString(__props.credits), 1)])) : createCommentVNode("", true)
				]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { credits_button_vue_vue_type_script_setup_true_lang_default as default };

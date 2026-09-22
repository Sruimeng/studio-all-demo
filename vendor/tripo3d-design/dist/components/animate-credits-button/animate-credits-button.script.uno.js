import { cn } from "../../utils/config.js";
import animate_button_default from "../../ui/animate-button/animate-button.uno.js";
import icon_default from "../../ui/icon/icon.uno.js";
import { createBlock, createCommentVNode, createElementBlock, createPropsRestProxy, createTextVNode, createVNode, defineComponent, mergeProps, normalizeClass, openBlock, renderSlot, toDisplayString, unref, withCtx } from "vue";
//#region src/components/animate-credits-button/animate-credits-button.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = {
	key: 1,
	class: "flex gap-1 items-center"
};
var animate_credits_button_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "animate-credits-button",
	props: {
		credits: {},
		iconClass: { default: "" },
		subscribe: { type: Boolean },
		class: {},
		alwaysAnimate: { type: Boolean },
		as: {},
		disabled: { type: Boolean },
		loading: { type: Boolean },
		wrapperClass: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, [
			"credits",
			"iconClass",
			"loading",
			"subscribe",
			"wrapperClass"
		]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(animate_button_default), mergeProps(other, {
				loading: __props.loading,
				"wrapper-class": unref(cn)("gap-1", __props.wrapperClass)
			}), {
				default: withCtx(() => [
					__props.subscribe ? (openBlock(), createBlock(unref(icon_default), {
						key: 0,
						icon: "i-tripo:subscribe",
						class: normalizeClass(unref(cn)("size-5", __props.loading && "c-gray-400!", __props.iconClass))
					}, null, 8, ["class"])) : createCommentVNode("", true),
					renderSlot(_ctx.$slots, "default"),
					__props.credits ? (openBlock(), createElementBlock("div", _hoisted_1, [createVNode(unref(icon_default), {
						icon: "i-tripo:bolt",
						class: normalizeClass(unref(cn)("size-5", __props.loading && "c-gray-400!", __props.iconClass))
					}, null, 8, ["class"]), createTextVNode(" " + toDisplayString(__props.credits), 1)])) : createCommentVNode("", true)
				]),
				_: 3
			}, 16, ["loading", "wrapper-class"]);
		};
	}
});
//#endregion
export { animate_credits_button_vue_vue_type_script_setup_true_lang_default as default };

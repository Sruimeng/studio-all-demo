import { cn } from "../../utils/config.js";
import { createElementBlock, createElementVNode, defineComponent, normalizeClass, normalizeStyle, openBlock, unref } from "vue";
//#region src/components/loading/loading-icon.vue?vue&type=script&setup=true&lang.ts
var loading_icon_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "loading-icon",
	props: {
		gap: { default: 12 },
		monochrome: {
			type: Boolean,
			default: false
		},
		size: { default: 8 },
		class: {}
	},
	setup(__props) {
		const props = __props;
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", {
				class: normalizeClass(unref(cn)("loading-container flex items-center justify-center", props.class)),
				style: normalizeStyle({
					"--gap": `${props.gap}px`,
					"width": `${props.size * 2 + props.gap * 2}px`
				})
			}, [createElementVNode("div", {
				class: normalizeClass(["ball ball-1 rounded-full", props.monochrome ? "bg-gray-500" : "bg-yellow-1"]),
				style: normalizeStyle({
					width: `${props.size}px`,
					height: `${props.size}px`
				})
			}, null, 6), createElementVNode("div", {
				class: normalizeClass(["ball ball-2 rounded-full", props.monochrome ? "bg-gray-800" : "bg-purple-1"]),
				style: normalizeStyle({
					width: `${props.size}px`,
					height: `${props.size}px`
				})
			}, null, 6)], 6);
		};
	}
});
//#endregion
export { loading_icon_vue_vue_type_script_setup_true_lang_default as default };

import { cn } from "../../utils/config.js";
import scroll_bar_default from "./scroll-bar.uno.js";
import { createBlock, createPropsRestProxy, createVNode, defineComponent, mergeProps, normalizeClass, openBlock, renderSlot, unref, withCtx } from "vue";
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from "reka-ui";
//#region src/ui/scroll-area/scroll-area.vue?vue&type=script&setup=true&lang.ts
var scroll_area_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "scroll-area",
	props: {
		type: {},
		dir: {},
		scrollHideDelay: {},
		asChild: { type: Boolean },
		as: {},
		class: {},
		viewportClass: {}
	},
	setup(__props) {
		const delegatedProps = createPropsRestProxy(__props, ["class", "viewportClass"]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(ScrollAreaRoot), mergeProps(delegatedProps, { class: unref(cn)("relative", __props.class) }), {
				default: withCtx(() => [
					createVNode(unref(ScrollAreaViewport), { class: normalizeClass(unref(cn)("outline-none size-full", __props.viewportClass)) }, {
						default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
						_: 3
					}, 8, ["class"]),
					createVNode(scroll_bar_default, { orientation: "vertical" }),
					createVNode(scroll_bar_default, { orientation: "horizontal" }),
					createVNode(unref(ScrollAreaCorner))
				]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { scroll_area_vue_vue_type_script_setup_true_lang_default as default };

import { cn } from "../../utils/config.js";
import { createBlock, createVNode, defineComponent, mergeProps, openBlock, unref, withCtx } from "vue";
import { ScrollAreaScrollbar, ScrollAreaThumb } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
//#region src/ui/scroll-area/scroll-bar.vue?vue&type=script&setup=true&lang.ts
var scroll_bar_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "scroll-bar",
	props: {
		orientation: { default: "vertical" },
		forceMount: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	setup(__props) {
		const props = __props;
		const delegatedProps = reactiveOmit(props, "class");
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(ScrollAreaScrollbar), mergeProps({ "data-slot": "scroll-area-scrollbar" }, unref(delegatedProps), { class: unref(cn)("flex touch-none p-px transition-colors select-none cursor-pointer", __props.orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent", __props.orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent", props.class) }), {
				default: withCtx(() => [createVNode(unref(ScrollAreaThumb), {
					"data-slot": "scroll-area-thumb",
					class: "rounded-full bg-gray-4 flex-1 relative"
				})]),
				_: 1
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { scroll_bar_vue_vue_type_script_setup_true_lang_default as default };

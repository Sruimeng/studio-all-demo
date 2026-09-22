import { cn } from "../../utils/config.js";
import { createElementBlock, createPropsRestProxy, defineComponent, mergeProps, openBlock, renderSlot, unref } from "vue";
//#region src/ui/badge/badge.vue?vue&type=script&setup=true&lang.ts
var badge_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "badge",
	props: { class: {} },
	setup(__props) {
		const other = createPropsRestProxy(__props, ["class"]);
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", mergeProps(other, { class: unref(cn)("absolute right-0 top-0 box-border min-w-3 min-h-2.5 rounded-full bg-red px-1.25 py-0.25 text-2.5 translate-x-1/2", __props.class) }), [renderSlot(_ctx.$slots, "default")], 16);
		};
	}
});
//#endregion
export { badge_vue_vue_type_script_setup_true_lang_default as default };

import { cn } from "../../utils/config.js";
import { createBlock, createPropsRestProxy, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { TabsContent } from "reka-ui";
//#region src/ui/tabs/tabs-content.vue?vue&type=script&setup=true&lang.ts
var tabs_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "tabs-content",
	props: {
		class: {},
		value: {},
		forceMount: { type: Boolean },
		asChild: { type: Boolean },
		as: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, ["class"]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(TabsContent), mergeProps({ class: unref(cn)("focus-visible:outline-none", __props.class) }, other), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { tabs_content_vue_vue_type_script_setup_true_lang_default as default };

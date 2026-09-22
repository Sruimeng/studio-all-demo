import { cn } from "../../utils/config.js";
import { createBlock, createPropsRestProxy, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { TabsList } from "reka-ui";
//#region src/ui/tabs/tabs-list.vue?vue&type=script&setup=true&lang.ts
var tabs_list_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "tabs-list",
	props: {
		class: {},
		loop: { type: Boolean },
		asChild: { type: Boolean },
		as: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, ["class"]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(TabsList), mergeProps(other, { class: unref(cn)("flex items-center justify-center", __props.class) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { tabs_list_vue_vue_type_script_setup_true_lang_default as default };

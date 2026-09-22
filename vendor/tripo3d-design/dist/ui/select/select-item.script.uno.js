import { cn } from "../../utils/config.js";
import { createBlock, createPropsRestProxy, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { SelectItem } from "reka-ui";
//#region src/ui/select/select-item.vue?vue&type=script&setup=true&lang.ts
var select_item_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "select-item",
	props: {
		value: {},
		disabled: { type: Boolean },
		textValue: {},
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, ["class"]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(SelectItem), mergeProps(other, { class: unref(cn)("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", __props.class) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { select_item_vue_vue_type_script_setup_true_lang_default as default };

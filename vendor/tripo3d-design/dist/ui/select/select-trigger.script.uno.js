import { cn } from "../../utils/config.js";
import icon_default from "../icon/icon.uno.js";
import { createBlock, createPropsRestProxy, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { SelectIcon, SelectTrigger, useForwardProps } from "reka-ui";
//#region src/ui/select/select-trigger.vue?vue&type=script&setup=true&lang.ts
var select_trigger_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "select-trigger",
	props: {
		disabled: { type: Boolean },
		reference: {},
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, ["class"]);
		const forwardedProps = useForwardProps(other);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(SelectTrigger), mergeProps(unref(forwardedProps), { class: unref(cn)("group w-full flex items-center justify-center gap-1 border border-white-10 rounded-3 py-3 [&>span]:line-clamp-1 focus:outline-none cursor-pointer", __props.class) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default"), createVNode(unref(SelectIcon), { "as-child": "" }, {
					default: withCtx(() => [createVNode(unref(icon_default), {
						icon: "i-tripo:angle",
						class: "transition group-data-[state=open]:rotate-180"
					})]),
					_: 1
				})]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { select_trigger_vue_vue_type_script_setup_true_lang_default as default };

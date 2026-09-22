import { cn } from "../../utils/config.js";
import TableCell_default from "./TableCell.uno.js";
import TableRow_default from "./TableRow.uno.js";
import { createBlock, createElementVNode, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
//#region src/ui/table/TableEmpty.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = { class: "py-10 flex items-center justify-center" };
var TableEmpty_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TableEmpty",
	props: {
		class: {},
		colspan: { default: 1 }
	},
	setup(__props) {
		const props = __props;
		return (_ctx, _cache) => {
			return openBlock(), createBlock(TableRow_default, null, {
				default: withCtx(() => [createVNode(TableCell_default, mergeProps(props, { class: unref(cn)("p-4 whitespace-nowrap align-middle text-sm text-foreground", props.class) }), {
					default: withCtx(() => [createElementVNode("div", _hoisted_1, [renderSlot(_ctx.$slots, "default")])]),
					_: 3
				}, 16, ["class"])]),
				_: 3
			});
		};
	}
});
//#endregion
export { TableEmpty_vue_vue_type_script_setup_true_lang_default as default };

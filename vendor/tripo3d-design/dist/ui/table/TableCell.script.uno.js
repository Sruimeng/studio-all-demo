import { cn } from "../../utils/config.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/table/TableCell.vue?vue&type=script&setup=true&lang.ts
var TableCell_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TableCell",
	props: { class: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("td", {
				"data-slot": "table-cell",
				class: normalizeClass(unref(cn)("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { TableCell_vue_vue_type_script_setup_true_lang_default as default };

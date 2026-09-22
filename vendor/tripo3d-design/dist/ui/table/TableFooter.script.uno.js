import { cn } from "../../utils/config.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/table/TableFooter.vue?vue&type=script&setup=true&lang.ts
var TableFooter_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TableFooter",
	props: { class: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("tfoot", {
				"data-slot": "table-footer",
				class: normalizeClass(unref(cn)("bg-[#F4F4F5]/50 border-t font-medium [&>tr]:last:border-b-0", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { TableFooter_vue_vue_type_script_setup_true_lang_default as default };

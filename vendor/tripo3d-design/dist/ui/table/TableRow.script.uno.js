import { cn } from "../../utils/config.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/table/TableRow.vue?vue&type=script&setup=true&lang.ts
var TableRow_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TableRow",
	props: { class: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("tr", {
				"data-slot": "table-row",
				class: normalizeClass(unref(cn)("hover:bg-[#F4F4F5]/50 data-[state=selected]:bg-[#F4F4F5] border-b transition-colors", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { TableRow_vue_vue_type_script_setup_true_lang_default as default };

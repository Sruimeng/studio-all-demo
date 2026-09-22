import { cn } from "../../utils/config.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/table/Table.vue?vue&type=script&setup=true&lang.ts
var Table_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Table",
	props: { class: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("table", {
				"data-slot": "table",
				class: normalizeClass(unref(cn)("w-full caption-bottom text-sm", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { Table_vue_vue_type_script_setup_true_lang_default as default };

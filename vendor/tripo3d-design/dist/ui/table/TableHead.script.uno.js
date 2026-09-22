import { cn } from "../../utils/config.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/table/TableHead.vue?vue&type=script&setup=true&lang.ts
var TableHead_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TableHead",
	props: { class: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("th", {
				"data-slot": "table-head",
				class: normalizeClass(unref(cn)("c-[#71717A] h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { TableHead_vue_vue_type_script_setup_true_lang_default as default };

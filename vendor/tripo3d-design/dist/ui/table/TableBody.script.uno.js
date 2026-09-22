import { cn } from "../../utils/config.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/table/TableBody.vue?vue&type=script&setup=true&lang.ts
var TableBody_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TableBody",
	props: { class: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("tbody", {
				"data-slot": "table-body",
				class: normalizeClass(unref(cn)("[&_tr:last-child]:border-0", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { TableBody_vue_vue_type_script_setup_true_lang_default as default };

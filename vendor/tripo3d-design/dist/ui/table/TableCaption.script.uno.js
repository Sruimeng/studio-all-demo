import { cn } from "../../utils/config.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/table/TableCaption.vue?vue&type=script&setup=true&lang.ts
var TableCaption_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "TableCaption",
	props: { class: {} },
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("caption", {
				"data-slot": "table-caption",
				class: normalizeClass(unref(cn)("c-[#71717A] mt-4 text-sm", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { TableCaption_vue_vue_type_script_setup_true_lang_default as default };

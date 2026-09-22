import { useGuideAnchor } from "./utils.js";
import { createElementBlock, defineComponent, openBlock, renderSlot } from "vue";
//#region src/components/guide/guide-anchor.vue?vue&type=script&setup=true&lang.ts
var guide_anchor_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "guide-anchor",
	setup(__props) {
		const anchor = useGuideAnchor();
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", { ref: (el) => {
				anchor.value = el;
			} }, [renderSlot(_ctx.$slots, "default")], 512);
		};
	}
});
//#endregion
export { guide_anchor_vue_vue_type_script_setup_true_lang_default as default };

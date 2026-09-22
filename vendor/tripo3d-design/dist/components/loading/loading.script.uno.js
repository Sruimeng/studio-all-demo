import dialog_default from "../../ui/dialog/dialog.uno.js";
import loading_icon_default from "./loading-icon.uno.js";
import { createBlock, createElementVNode, createVNode, defineComponent, openBlock, renderSlot, unref, withCtx } from "vue";
//#region src/components/loading/loading.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = { class: "flex flex-col items-center justify-center" };
var loading_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "loading",
	setup(__props) {
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(dialog_default), { class: "z-60" }, {
				default: withCtx(() => [createElementVNode("div", _hoisted_1, [createVNode(loading_icon_default), renderSlot(_ctx.$slots, "default")])]),
				_: 3
			});
		};
	}
});
//#endregion
export { loading_vue_vue_type_script_setup_true_lang_default as default };

import { cn } from "../../utils/config.js";
import icon_default from "../icon/icon.uno.js";
import { createElementBlock, createElementVNode, createVNode, defineComponent, normalizeClass, openBlock, renderSlot, unref, withCtx } from "vue";
import { PopoverClose } from "reka-ui";
//#region src/ui/popover/popover-title.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = { class: "leading-5" };
var popover_title_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "popover-title",
	props: { class: {} },
	setup(__props) {
		const props = __props;
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", { class: normalizeClass(unref(cn)("relative mb-2 flex items-center justify-between", props.class)) }, [createElementVNode("div", _hoisted_1, [renderSlot(_ctx.$slots, "default")]), createVNode(unref(PopoverClose), null, {
				default: withCtx(() => [createVNode(icon_default, {
					icon: "i-tripo:close",
					class: "text-gray-400 size-4 cursor-pointer"
				})]),
				_: 1
			})], 2);
		};
	}
});
//#endregion
export { popover_title_vue_vue_type_script_setup_true_lang_default as default };

import icon_default from "../../ui/icon/icon.uno.js";
import tooltip_trigger_default from "../../ui/tooltip/tooltip-trigger.uno.js";
import { useGuideAnchor } from "./utils.js";
import { createBlock, createCommentVNode, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
//#region src/components/guide/guide-trigger.vue?vue&type=script&setup=true&lang.ts
var guide_trigger_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "guide-trigger",
	props: {
		asChild: { type: Boolean },
		as: {}
	},
	setup(__props) {
		const props = __props;
		const anchor = useGuideAnchor();
		return (_ctx, _cache) => {
			return unref(anchor) ? (openBlock(), createBlock(unref(tooltip_trigger_default), mergeProps({ key: 0 }, props, { reference: unref(anchor) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default", {}, () => [createVNode(unref(icon_default), {
					icon: "i-tripo:tips",
					class: "c-gray-500 size-4"
				})])]),
				_: 3
			}, 16, ["reference"])) : createCommentVNode("", true);
		};
	}
});
//#endregion
export { guide_trigger_vue_vue_type_script_setup_true_lang_default as default };

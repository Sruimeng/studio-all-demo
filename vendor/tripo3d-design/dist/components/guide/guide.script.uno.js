import tooltip_default from "../../ui/tooltip/tooltip.uno.js";
import { useProvideGuideAnchor } from "./utils.js";
import { createBlock, defineComponent, guardReactiveProps, normalizeProps, openBlock, renderSlot, shallowRef, unref, withCtx } from "vue";
import { useForwardPropsEmits } from "reka-ui";
//#region src/components/guide/guide.vue?vue&type=script&setup=true&lang.ts
var guide_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "guide",
	props: {
		touchable: {
			type: Boolean,
			default: false
		},
		defaultOpen: { type: Boolean },
		open: { type: Boolean },
		delayDuration: { default: 0 },
		disableHoverableContent: { type: Boolean },
		disableClosingTrigger: { type: Boolean },
		disabled: { type: Boolean },
		ignoreNonKeyboardFocus: { type: Boolean }
	},
	emits: ["update:open"],
	setup(__props, { emit: __emit }) {
		const forwarded = useForwardPropsEmits(__props, __emit);
		const anchor = shallowRef(void 0);
		useProvideGuideAnchor(anchor);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(tooltip_default), normalizeProps(guardReactiveProps(unref(forwarded))), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16);
		};
	}
});
//#endregion
export { guide_vue_vue_type_script_setup_true_lang_default as default };

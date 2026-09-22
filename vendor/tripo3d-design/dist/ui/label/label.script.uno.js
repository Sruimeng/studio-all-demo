import { cn } from "../../utils/config.js";
import { createBlock, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { Label } from "reka-ui";
//#region src/ui/label/label.vue?vue&type=script&setup=true&lang.ts
var label_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "label",
	props: {
		for: {},
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	setup(__props) {
		const props = __props;
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(Label), mergeProps(props, { class: unref(cn)("text-3.5 peer-disabled:cursor-not-allowed peer-disabled:opacity-50", props.class) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { label_vue_vue_type_script_setup_true_lang_default as default };

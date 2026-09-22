import { cn } from "../../utils/config.js";
import { createBlock, defineComponent, mergeProps, openBlock, unref } from "vue";
import { PinInputInput, useForwardProps } from "reka-ui";
//#region src/ui/pin-input/pin-input-input.vue?vue&type=script&setup=true&lang.ts
var pin_input_input_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "pin-input-input",
	props: {
		index: {},
		disabled: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
		class: {}
	},
	setup(__props) {
		const props = __props;
		const forwarded = useForwardProps(props);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(PinInputInput), mergeProps(unref(forwarded), { class: unref(cn)("text-center outline-none border rounded-lg bg-transparent h-10 w-10 border-gray-100 c-gray-100", props.class) }), null, 16, ["class"]);
		};
	}
});
//#endregion
export { pin_input_input_vue_vue_type_script_setup_true_lang_default as default };

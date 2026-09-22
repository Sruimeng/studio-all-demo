import { createElementBlock, defineComponent, mergeProps, openBlock, ref, useTemplateRef, watch, withModifiers } from "vue";
//#region src/components/snap-input/snap-input.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["value"];
var snap_input_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	name: "SnapInput",
	__name: "snap-input",
	props: { value: {} },
	emits: ["change"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emit = __emit;
		const editValue = ref(props.value);
		const input = useTemplateRef("input");
		watch(() => props.value, (nextValue) => {
			editValue.value = nextValue;
		});
		const handleInputChange = (e) => {
			editValue.value = e.target.value;
		};
		const handleBlur = () => {
			emit("change", editValue.value);
		};
		const handleKeyDown = (e) => {
			if (!input.value) return;
			if (e.key === "Enter") input.value.blur();
			else if (e.key === "Escape") input.value.blur();
		};
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("input", mergeProps({
				ref_key: "input",
				ref: input,
				type: "text",
				value: editValue.value
			}, _ctx.$attrs, {
				onClick: _cache[0] || (_cache[0] = withModifiers(() => {}, ["stop"])),
				onBlur: handleBlur,
				onKeydown: handleKeyDown,
				onInput: handleInputChange
			}), null, 16, _hoisted_1);
		};
	}
});
//#endregion
export { snap_input_vue_vue_type_script_setup_true_lang_default as default };

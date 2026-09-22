import { checkSize, checkType } from "../../utils/utils.js";
import { createElementBlock, defineComponent, openBlock } from "vue";
//#region src/components/model-uploader/model-uploader-input.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["size", "accept"];
var model_uploader_input_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "model-uploader-input",
	props: {
		accept: { default: ".fbx,.obj,.stl,.glb" },
		size: { default: 150 }
	},
	emits: [
		"change",
		"size-error",
		"type-error"
	],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emit = __emit;
		const handleChange = (e) => {
			const target = e.target;
			const model = target.files?.[0];
			if (!model) return;
			if (!checkSize(model, props.size)) {
				emit("size-error", model);
				return;
			}
			if (!checkType(model, "model")) {
				emit("type-error", model);
				return;
			}
			emit("change", model);
			target.value = "";
		};
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("input", {
				max: "1",
				type: "file",
				multiple: false,
				size: props.size,
				accept: props.accept,
				class: "opacity-0 cursor-pointer inset-0 absolute z-2",
				onChange: handleChange
			}, null, 40, _hoisted_1);
		};
	}
});
//#endregion
export { model_uploader_input_vue_vue_type_script_setup_true_lang_default as default };

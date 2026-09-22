import { checkSize, checkType } from "../../utils/utils.js";
import { createElementBlock, defineComponent, openBlock } from "vue";
//#region src/components/img-uploader/img-uploader-input.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["size", "multiple"];
var img_uploader_input_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "img-uploader-input",
	props: {
		multiple: {
			type: Boolean,
			default: false
		},
		size: { default: 5 }
	},
	emits: [
		"change",
		"size-error",
		"type-error"
	],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emit = __emit;
		const processFiles = (fileList) => {
			const files = Array.from(fileList).filter((file) => {
				if (!file) return false;
				if (!checkSize(file, props.size)) {
					emit("size-error", file);
					return false;
				}
				if (!checkType(file, "image")) {
					emit("type-error", file);
					return false;
				}
				return true;
			});
			emit("change", files);
		};
		const handleChange = (e) => {
			const target = e.target;
			if (!target.files) return;
			processFiles(target.files);
			target.value = "";
		};
		const handleDrop = (e) => {
			e.preventDefault();
			if (!e.dataTransfer?.files) return;
			processFiles(e.dataTransfer.files);
			e.dataTransfer?.clearData();
		};
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("input", {
				max: 10,
				type: "file",
				size: props.size,
				multiple: props.multiple,
				class: "opacity-0 cursor-pointer inset-0 absolute",
				accept: "image/png,image/webp,image/jpg,image/jpeg",
				onDrop: handleDrop,
				onChange: handleChange
			}, null, 40, _hoisted_1);
		};
	}
});
//#endregion
export { img_uploader_input_vue_vue_type_script_setup_true_lang_default as default };

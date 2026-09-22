import { cn } from "../../utils/config.js";
import icon_default from "../../ui/icon/icon.uno.js";
import img_uploader_input_default from "./img-uploader-input.uno.js";
import grid_default from "../../assets/grid.js";
import { createBlock, createCommentVNode, createElementBlock, createElementVNode, createVNode, defineComponent, normalizeClass, normalizeStyle, openBlock, ref, toDisplayString, unref, withModifiers } from "vue";
//#region src/components/img-uploader/img-uploader.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["data-drag-over"];
var _hoisted_2 = {
	key: 1,
	class: "text-2.5 c-white my-1.5 text-center max-w-2/3 w-37.5 text-wrap"
};
var _hoisted_3 = {
	key: 2,
	class: "text-2.5 c-gray-500 text-center max-w-2/3 w-37.5 text-wrap"
};
var BaseStyle = "flex flex-col size-full items-center justify-center relative overflow-hidden hover:bg-white-5";
var BorderStyle = "border border-white-20 border-dashed box-border";
var DragOverStyle = "data-[drag-over=true]:bg-purple-10";
var img_uploader_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "img-uploader",
	props: {
		class: {},
		description: {},
		icon: {},
		multiple: { type: Boolean },
		required: { type: Boolean },
		size: {},
		title: {}
	},
	emits: [
		"change",
		"size-error",
		"type-error"
	],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emit = __emit;
		const isDragOver = ref(false);
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", {
				"data-drag-over": isDragOver.value,
				class: normalizeClass(unref(cn)(BaseStyle, BorderStyle, DragOverStyle, props.class)),
				onDrop: _cache[3] || (_cache[3] = withModifiers(($event) => isDragOver.value = false, ["prevent"])),
				onDragover: _cache[4] || (_cache[4] = withModifiers(($event) => isDragOver.value = true, ["prevent"])),
				onDragleave: _cache[5] || (_cache[5] = withModifiers(($event) => isDragOver.value = false, ["prevent"]))
			}, [
				__props.icon ? (openBlock(), createBlock(unref(icon_default), {
					key: 0,
					icon: __props.icon,
					class: "size-5"
				}, null, 8, ["icon"])) : createCommentVNode("", true),
				__props.title ? (openBlock(), createElementBlock("div", _hoisted_2, toDisplayString(__props.title), 1)) : createCommentVNode("", true),
				__props.description ? (openBlock(), createElementBlock("div", _hoisted_3, toDisplayString(__props.description), 1)) : createCommentVNode("", true),
				__props.required ? (openBlock(), createBlock(unref(icon_default), {
					key: 3,
					icon: "i-tripo:required",
					class: "c-red size-3 right-3 top-3 absolute"
				})) : createCommentVNode("", true),
				createElementVNode("div", {
					style: normalizeStyle({ backgroundImage: `url(${unref(grid_default)})` }),
					class: "size-full left-0 top-0 absolute z-0 bg-contain bg-repeat"
				}, null, 4),
				createVNode(img_uploader_input_default, {
					size: props.size,
					multiple: props.multiple,
					onChange: _cache[0] || (_cache[0] = ($event) => emit("change", $event)),
					onSizeError: _cache[1] || (_cache[1] = ($event) => emit("size-error", $event)),
					onTypeError: _cache[2] || (_cache[2] = ($event) => emit("type-error", $event))
				}, null, 8, ["size", "multiple"])
			], 42, _hoisted_1);
		};
	}
});
//#endregion
export { img_uploader_vue_vue_type_script_setup_true_lang_default as default };

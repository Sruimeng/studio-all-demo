import { cn } from "../../utils/config.js";
import icon_default from "../../ui/icon/icon.uno.js";
import grid_default from "../../assets/grid.js";
import model_uploader_input_default from "./model-uploader-input.uno.js";
import { createBlock, createCommentVNode, createElementBlock, createElementVNode, createVNode, defineComponent, normalizeClass, normalizeStyle, openBlock, renderSlot, toDisplayString, unref } from "vue";
//#region src/components/model-uploader/model-uploader.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = {
	key: 0,
	class: "p-1.5 rounded-6 bg-purple-1 flex items-center justify-center relative z-1"
};
var _hoisted_2 = {
	key: 0,
	class: "text-2.5 c-white my-1 text-center max-w-2/3 w-37.5 text-wrap relative z-1"
};
var _hoisted_3 = {
	key: 0,
	class: "text-2.5 c-gray-500 text-center max-w-2/3 w-37.5 text-wrap relative z-1"
};
var BaseStyle = "flex flex-col size-full items-center justify-center relative overflow-hidden hover:bg-white-5";
var BorderStyle = "border border-white-20 border-dashed box-border";
var model_uploader_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "model-uploader",
	props: {
		class: {},
		description: {},
		icon: {},
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
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", { class: normalizeClass(unref(cn)(BaseStyle, BorderStyle, props.class)) }, [
				props.icon ? (openBlock(), createElementBlock("div", _hoisted_1, [createVNode(unref(icon_default), {
					class: "size-4",
					icon: props.icon
				}, null, 8, ["icon"])])) : createCommentVNode("", true),
				renderSlot(_ctx.$slots, "title", {}, () => [props.title ? (openBlock(), createElementBlock("div", _hoisted_2, toDisplayString(props.title), 1)) : createCommentVNode("", true)]),
				renderSlot(_ctx.$slots, "description", {}, () => [props.description ? (openBlock(), createElementBlock("div", _hoisted_3, toDisplayString(props.description), 1)) : createCommentVNode("", true)]),
				props.required ? (openBlock(), createBlock(unref(icon_default), {
					key: 1,
					icon: "i-tripo:required-monotone",
					class: "c-red size-6 right-3 top-3 absolute z-1"
				})) : createCommentVNode("", true),
				createElementVNode("div", {
					style: normalizeStyle({ backgroundImage: `url(${unref(grid_default)})` }),
					class: "size-full left-0 top-0 absolute z-0 bg-contain bg-repeat"
				}, null, 4),
				createVNode(model_uploader_input_default, {
					size: props.size,
					onChange: _cache[0] || (_cache[0] = ($event) => emit("change", $event)),
					onSizeError: _cache[1] || (_cache[1] = ($event) => emit("size-error", $event)),
					onTypeError: _cache[2] || (_cache[2] = ($event) => emit("type-error", $event))
				}, null, 8, ["size"])
			], 2);
		};
	}
});
//#endregion
export { model_uploader_vue_vue_type_script_setup_true_lang_default as default };

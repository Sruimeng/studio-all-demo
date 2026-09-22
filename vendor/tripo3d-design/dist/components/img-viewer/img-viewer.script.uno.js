import { cn } from "../../utils/config.js";
import { provideImage } from "./helper.js";
import { Fragment, computed, createCommentVNode, createElementBlock, defineComponent, normalizeClass, normalizeStyle, openBlock, renderList, renderSlot, unref } from "vue";
//#region src/components/img-viewer/img-viewer.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = [
	"alt",
	"src",
	"loading"
];
var _hoisted_2 = [
	"src",
	"alt",
	"loading"
];
var BaseStyle = "group size-full relative overflow-hidden";
var BorderStyle = "border border-white-10 box-border";
var img_viewer_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "img-viewer",
	props: {
		class: {},
		alt: {},
		loading: {},
		src: {}
	},
	setup(__props) {
		const props = __props;
		const images = computed(() => {
			return (Array.isArray(props.src) ? props.src : [props.src]).filter(Boolean).map((source) => {
				if (source instanceof File) return URL.createObjectURL(source);
				return source;
			});
		});
		provideImage(images);
		const rotations = [
			-15,
			0,
			15
		];
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", { class: normalizeClass(unref(cn)(BaseStyle, BorderStyle, props.class)) }, [images.value.length === 1 ? (openBlock(), createElementBlock("img", {
				key: 0,
				alt: props.alt,
				src: images.value[0],
				loading: props.loading,
				class: "size-full object-contain"
			}, null, 8, _hoisted_1)) : images.value.length > 1 ? (openBlock(true), createElementBlock(Fragment, { key: 1 }, renderList(images.value.slice(-3), (url, index) => {
				return openBlock(), createElementBlock("img", {
					key: `${url}${index}`,
					src: url,
					alt: props.alt,
					loading: props.loading,
					style: normalizeStyle({ transform: `translate(-50%, -50%) rotate(${rotations[index]}deg)` }),
					class: "rounded-3.5 size-4/5 shadow-[0px_1px_10px_0px] shadow-black-10 left-1/2 top-1/2 absolute object-contain"
				}, null, 12, _hoisted_2);
			}), 128)) : createCommentVNode("", true), renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { img_viewer_vue_vue_type_script_setup_true_lang_default as default };

import { cn } from "../../utils/config.js";
import icon_default from "../../ui/icon/icon.uno.js";
import { useImage } from "./helper.js";
import { createCommentVNode, createElementBlock, createVNode, defineComponent, normalizeClass, openBlock, unref } from "vue";
//#region src/components/img-viewer/img-viewer-delete.vue?vue&type=script&setup=true&lang.ts
var img_viewer_delete_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "img-viewer-delete",
	props: { class: {} },
	setup(__props) {
		const props = __props;
		const images = useImage();
		return (_ctx, _cache) => {
			return unref(images).length ? (openBlock(), createElementBlock("button", {
				key: 0,
				class: normalizeClass(unref(cn)("absolute bottom-3 right-3 opacity-0 rounded-1/2 transition group-hover:opacity-100 group-hover:bg-black-60", props.class))
			}, [createVNode(unref(icon_default), {
				icon: "i-tripo:delete",
				class: "c-gray-100 m-2 size-5"
			})], 2)) : createCommentVNode("", true);
		};
	}
});
//#endregion
export { img_viewer_delete_vue_vue_type_script_setup_true_lang_default as default };

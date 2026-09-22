import { cn } from "../../utils/config.js";
import loading_icon_default from "../loading/loading-icon.uno.js";
import { Fragment, createCommentVNode, createElementBlock, createElementVNode, createVNode, defineComponent, normalizeClass, onBeforeUnmount, onMounted, openBlock, ref, renderSlot, unref, useTemplateRef } from "vue";
//#region src/components/loadable/loadable.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = {
	ref: "div",
	class: "min-h-10 w-full"
};
var loadable_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "loadable",
	props: {
		load: { type: Function },
		class: {}
	},
	setup(__props) {
		const props = __props;
		const divRef = useTemplateRef("div");
		const loading = ref(false);
		const observer = ref();
		onMounted(() => {
			observer.value?.disconnect();
			observer.value = null;
			if (divRef.value === null) return;
			observer.value = new IntersectionObserver(async ([entry]) => {
				if (!entry || !entry.isIntersecting || loading.value) return;
				try {
					loading.value = true;
					await props.load();
				} catch (error) {
					console.error("加载更多数据时发生错误:", error);
				} finally {
					loading.value = false;
				}
			}, {
				root: null,
				rootMargin: "0px 0px 120px 0px",
				threshold: 0
			});
			observer.value.observe(divRef.value);
		});
		onBeforeUnmount(() => {
			observer.value?.disconnect();
			observer.value = null;
		});
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock(Fragment, null, [renderSlot(_ctx.$slots, "default"), createElementVNode("div", _hoisted_1, [loading.value ? (openBlock(), createElementBlock("div", {
				key: 0,
				class: normalizeClass(unref(cn)("w-full flex flex-col items-center justify-center gap-2 mt-5", props.class))
			}, [createVNode(unref(loading_icon_default))], 2)) : createCommentVNode("", true)], 512)], 64);
		};
	}
});
//#endregion
export { loadable_vue_vue_type_script_setup_true_lang_default as default };

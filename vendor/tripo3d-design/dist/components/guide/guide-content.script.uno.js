import { cn } from "../../utils/config.js";
import tooltip_content_default from "../../ui/tooltip/tooltip-content.uno.js";
import { computed, createBlock, createCommentVNode, createElementBlock, createElementVNode, createTextVNode, defineComponent, mergeProps, normalizeClass, openBlock, renderSlot, toDisplayString, unref, useSlots, withCtx } from "vue";
import { reactiveOmit } from "@vueuse/core";
//#region src/components/guide/guide-content.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["alt", "src"];
var guide_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	inheritAttrs: false,
	__name: "guide-content",
	props: {
		forceMount: { type: Boolean },
		ariaLabel: {},
		asChild: { type: Boolean },
		as: {},
		side: { default: "top" },
		sideOffset: { default: 12 },
		align: {},
		alignOffset: {},
		avoidCollisions: {
			type: Boolean,
			default: true
		},
		collisionBoundary: {},
		collisionPadding: { default: 12 },
		arrowPadding: {},
		sticky: {},
		hideWhenDetached: { type: Boolean },
		positionStrategy: {},
		updatePositionStrategy: {},
		class: {},
		alt: {},
		description: {},
		img: {},
		title: {}
	},
	setup(__props) {
		const props = __props;
		const slots = useSlots();
		const hasImg = computed(() => !!(slots.img || props.img));
		const hasTitle = computed(() => !!(slots.title || props.title));
		const hasDescription = computed(() => !!(slots.description || props.description));
		const delegatedProps = reactiveOmit(props, "class", "img", "alt", "title", "description");
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(tooltip_content_default), mergeProps({
				...unref(delegatedProps),
				..._ctx.$attrs
			}, { class: unref(cn)("p-3 w-66", props.class) }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default", {}, () => [
					hasImg.value ? renderSlot(_ctx.$slots, "img", { key: 0 }, () => [createElementVNode("img", {
						alt: props.alt,
						src: props.img,
						class: "rounded-2 w-full"
					}, null, 8, _hoisted_1)]) : createCommentVNode("", true),
					hasTitle.value ? (openBlock(), createElementBlock("h3", {
						key: 1,
						class: normalizeClass(`text-3.5 whitespace-pre-wrap ${hasImg.value ? "mt-3" : ""}`)
					}, [renderSlot(_ctx.$slots, "title", {}, () => [createTextVNode(toDisplayString(props.title), 1)])], 2)) : createCommentVNode("", true),
					hasDescription.value ? (openBlock(), createElementBlock("p", {
						key: 2,
						class: normalizeClass(unref(cn)("text-3 c-gray-400 whitespace-pre-wrap", hasTitle.value || hasImg.value ? "mt-2" : ""))
					}, [renderSlot(_ctx.$slots, "description", {}, () => [createTextVNode(toDisplayString(props.description), 1)])], 2)) : createCommentVNode("", true)
				])]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { guide_content_vue_vue_type_script_setup_true_lang_default as default };

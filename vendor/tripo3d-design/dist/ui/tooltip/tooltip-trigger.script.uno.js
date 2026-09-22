import { TOOLTIP_TOUCH_KEY } from "./context.js";
import { createBlock, defineComponent, inject, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { TooltipTrigger } from "reka-ui";
//#region src/ui/tooltip/tooltip-trigger.vue?vue&type=script&setup=true&lang.ts
var tooltip_trigger_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "tooltip-trigger",
	props: {
		reference: {},
		asChild: { type: Boolean },
		as: {}
	},
	setup(__props) {
		const props = __props;
		const touchCtx = inject(TOOLTIP_TOUCH_KEY, null);
		/**
		* 处理 pointerdown 事件，实现触摸设备上的点击触发
		*
		* 为什么用 pointerdown 而非 click？
		* - pointerdown 在 touch 序列最开始触发，能通过 pointerType 区分设备类型
		* - click 事件无法区分是真实点击还是 touch 模拟
		*
		* 为什么需要 preventDefault？
		* - 阻止浏览器将 touch 转为后续的 mouse 事件序列
		* - 避免 reka-ui 收到模拟的 hover 事件产生干扰
		*/
		function onPointerDown(e) {
			if (touchCtx && e.pointerType === "touch") {
				e.preventDefault();
				touchCtx.toggleByTouch();
			}
		}
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(TooltipTrigger), mergeProps(props, { onPointerdown: onPointerDown }), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16);
		};
	}
});
//#endregion
export { tooltip_trigger_vue_vue_type_script_setup_true_lang_default as default };

import { TOOLTIP_TOUCH_KEY } from "./context.js";
import { createBlock, defineComponent, mergeProps, openBlock, provide, ref, renderSlot, unref, watch, withCtx } from "vue";
import { TooltipRoot, useForwardProps } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
//#region src/ui/tooltip/tooltip-touch-root.vue?vue&type=script&setup=true&lang.ts
var tooltip_touch_root_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "tooltip-touch-root",
	props: {
		defaultOpen: { type: Boolean },
		open: { type: Boolean },
		delayDuration: { default: 0 },
		disableHoverableContent: { type: Boolean },
		disableClosingTrigger: { type: Boolean },
		disabled: { type: Boolean },
		ignoreNonKeyboardFocus: {
			type: Boolean,
			default: true
		}
	},
	emits: ["update:open"],
	setup(__props, { emit: __emit }) {
		/**
		* TooltipTouchRoot - 触摸模式下的 Tooltip 根组件
		*
		* 背景1：reka-ui 的 TooltipRoot 默认只支持 hover，无法满足触摸需求。且官方表示不愿支持
		* https://github.com/unovue/reka-ui/issues/1443
		*
		* 背景2：社区提出修复方案，未被采纳。本次调整参考了此方案
		* https://github.com/unovue/reka-ui/pull/1474
		*
		* 核心职责：
		* 1. 管理受控状态 (isOpen)，接管 reka-ui 的开关控制
		* 2. 防御浏览器 hover 模拟，避免 tooltip 被意外关闭
		* 3. 通过 provide 向子组件暴露触摸控制接口
		*
		* 为什么需要 openedByTouch 防御机制？
		* 触摸设备上浏览器会将 touch 转为 hover → click 事件序列：
		*   touchstart → touchend → mousemove → mouseenter → mousedown → mouseup → click
		* 当用户 touch 打开 tooltip 后，手指离开会触发 mouseleave，
		* reka-ui 检测到 hover 离开会发出 update:open(false)，导致 tooltip 立即关闭。
		* openedByTouch 标记让我们能识别并忽略这类"假"关闭事件。
		*/
		const props = __props;
		const emits = __emit;
		const isOpen = ref(props.defaultOpen ?? false);
		/**
		* 标记 tooltip 是否由 touch 打开
		* - true: 忽略 reka-ui 因 hover 模拟产生的 close 事件
		* - false: 正常响应所有 open/close 事件
		*/
		const openedByTouch = ref(false);
		watch(() => props.open, (val) => {
			if (val !== void 0) isOpen.value = val;
		});
		/**
		* 处理来自 reka-ui 的 update:open 事件
		* 关键：当 tooltip 由 touch 打开时，过滤掉浏览器 hover 模拟产生的关闭事件
		*/
		function handleUpdateOpen(value) {
			if (openedByTouch.value && !value) return;
			isOpen.value = value;
			emits("update:open", value);
		}
		function toggleByTouch() {
			const current = isOpen.value;
			isOpen.value = !current;
			openedByTouch.value = !current;
			emits("update:open", !current);
		}
		function closeByTouch() {
			isOpen.value = false;
			openedByTouch.value = false;
			emits("update:open", false);
		}
		provide(TOOLTIP_TOUCH_KEY, {
			closeByTouch,
			toggleByTouch
		});
		const delegatedProps = reactiveOmit(props, "open", "defaultOpen");
		const forwardedProps = useForwardProps(delegatedProps);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(TooltipRoot), mergeProps(unref(forwardedProps), {
				open: isOpen.value,
				"onUpdate:open": handleUpdateOpen
			}), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["open"]);
		};
	}
});
//#endregion
export { tooltip_touch_root_vue_vue_type_script_setup_true_lang_default as default };

import { cn } from "../../utils/config.js";
import button_default from "../button/button.uno.js";
import icon_default from "../icon/icon.uno.js";
import { useDialog } from "./utils.js";
import dialog_default from "./dialog.uno.js";
import { createBlock, createElementVNode, createTextVNode, createVNode, defineComponent, normalizeClass, openBlock, renderSlot, toDisplayString, unref, withCtx } from "vue";
//#region src/ui/dialog/confirm.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = { class: "text-4.5 c-gray-200 mb-4 mt-6 text-center" };
var _hoisted_2 = { class: "text-4 text-gray-500 text-center" };
var _hoisted_3 = { class: "mt-6 flex gap-4" };
var confirm_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "confirm",
	props: {
		cancelText: {},
		confirmText: {},
		description: {},
		onCancel: { type: Function },
		onConfirm: { type: Function },
		title: {},
		class: {}
	},
	setup(__props) {
		const props = __props;
		const dialog = useDialog();
		function cancel() {
			if (props.onCancel) props.onCancel(dialog);
			else dialog.close();
		}
		function confirm() {
			if (props.onConfirm) props.onConfirm(dialog);
			else dialog.close();
		}
		function handleOpenChange(open) {
			if (!open) cancel();
		}
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(dialog_default), { "onUpdate:open": handleOpenChange }, {
				default: withCtx(() => [createElementVNode("div", { class: normalizeClass(unref(cn)("w-95 p-4 rounded-6 bg-gray-2 relative", props.class)) }, [
					createVNode(unref(icon_default), {
						icon: "i-tripo:close",
						class: "color-gray-500 size-5 cursor-pointer right-4 top-4 absolute",
						onClick: cancel
					}),
					createElementVNode("h3", _hoisted_1, [renderSlot(_ctx.$slots, "title", {}, () => [createTextVNode(toDisplayString(props.title), 1)])]),
					createElementVNode("div", _hoisted_2, [renderSlot(_ctx.$slots, "description", {}, () => [createTextVNode(toDisplayString(props.description), 1)])]),
					createElementVNode("div", _hoisted_3, [renderSlot(_ctx.$slots, "cancel", {}, () => [createVNode(unref(button_default), {
						variant: "custom",
						class: "c-white font-bold bg-white-10 flex-1 h-10",
						onClick: cancel
					}, {
						default: withCtx(() => [createTextVNode(toDisplayString(props.cancelText), 1)]),
						_: 1
					})]), renderSlot(_ctx.$slots, "confirm", {}, () => [createVNode(unref(button_default), {
						class: "font-bold flex-1 h-10",
						onClick: confirm
					}, {
						default: withCtx(() => [createTextVNode(toDisplayString(props.confirmText), 1)]),
						_: 1
					})])])
				], 2)]),
				_: 3
			});
		};
	}
});
//#endregion
export { confirm_vue_vue_type_script_setup_true_lang_default as default };

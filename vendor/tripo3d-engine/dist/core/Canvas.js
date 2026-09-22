import { useProvideEngine } from "../composables/engine.js";
import { createBlock, defineComponent, openBlock, renderSlot, unref, withCtx } from "vue";
import { TresCanvas } from "@tresjs/core";

//#region src/core/Canvas.vue
const _sfc_main = /* @__PURE__ */ defineComponent({
	__name: "Canvas",
	props: { engine: {} },
	setup(__props) {
		useProvideEngine(__props.engine);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(TresCanvas), {
				shadows: "",
				antialias: "",
				"clear-alpha": 0,
				"clear-color": 0
			}, {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			});
		};
	}
});

//#endregion
export { _sfc_main as default };
import { computed, defineComponent, onBeforeUnmount, onMounted, shallowRef, toDisplayString, watchEffect } from "vue";
import { ViewportGizmo } from "three-viewport-gizmo";
import { useLoop, useTresContext } from "@tresjs/core";
import { useEventListener } from "@vueuse/core";

//#region src/components/camera-controls-gizmo.vue
const _sfc_main = /* @__PURE__ */ defineComponent({
	__name: "camera-controls-gizmo",
	props: {
		camera: {},
		controls: {},
		options: { default: () => ({ size: 72 }) }
	},
	setup(__props) {
		const { camera: contextCamera, controls: contextControls, renderer } = useTresContext();
		const { onRender } = useLoop();
		const props = __props;
		const presetContainer = document.createElement("div");
		presetContainer.style.position = "absolute";
		presetContainer.style.top = "2px";
		presetContainer.style.right = "2px";
		presetContainer.style.zIndex = "1";
		onMounted(() => {
			(renderer.instance.domElement.parentElement || document.body).appendChild(presetContainer);
		});
		const computedCamera = computed(() => props.camera || contextCamera.activeCamera.value);
		const computedRenderer = computed(() => renderer.instance);
		const computedControls = computed(() => props.controls || contextControls.value);
		const gizmoRef = shallowRef(null);
		const onStart = () => {
			if (computedControls.value) computedControls.value.enabled = false;
		};
		const onEnd = () => {
			if (computedControls.value) computedControls.value.enabled = true;
		};
		const onChange = () => {
			if (computedCamera.value && computedControls.value) computedControls.value.setPosition(computedCamera.value.position.x, computedCamera.value.position.y, computedCamera.value.position.z);
		};
		watchEffect(() => {
			if (gizmoRef.value) return;
			if (!computedCamera.value || !computedRenderer.value || !computedControls.value) return;
			gizmoRef.value = new ViewportGizmo(computedCamera.value, computedRenderer.value);
			useEventListener(gizmoRef.value, "start", onStart);
			useEventListener(gizmoRef.value, "end", onEnd);
			useEventListener(gizmoRef.value, "change", onChange);
		});
		watchEffect(() => {
			if (gizmoRef.value) gizmoRef.value.set({
				...props.options,
				container: props.options.container || presetContainer
			});
		});
		const { off } = onRender(() => {
			if (gizmoRef.value && computedControls.value) {
				computedControls.value.getTarget(gizmoRef.value.target);
				gizmoRef.value.update();
				gizmoRef.value.render();
			}
		});
		onBeforeUnmount(() => {
			off();
			const parent = presetContainer.parentElement;
			if (parent) parent.removeChild(presetContainer);
			if (gizmoRef.value) {
				gizmoRef.value.dispose();
				gizmoRef.value = null;
			}
		});
		return (_ctx, _cache) => {
			return toDisplayString(null);
		};
	}
});

//#endregion
export { _sfc_main as default };
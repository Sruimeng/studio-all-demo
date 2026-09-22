import { computed, defineComponent, markRaw, onBeforeUnmount, onMounted, toDisplayString, watch } from "vue";
import { useTres } from "@tresjs/core";
import { TransformControls } from "three/examples/jsm/Addons.js";

//#region src/components/transform-controls.vue
const _sfc_main = /* @__PURE__ */ defineComponent({
	__name: "transform-controls",
	props: {
		axis: {},
		camera: {},
		enabled: {
			type: Boolean,
			default: true
		},
		mode: {},
		object: {},
		rotationSnap: {},
		scaleSnap: {},
		translationSnap: {}
	},
	emits: [
		"dragging",
		"change",
		"mouseDown",
		"mouseUp",
		"objectChange"
	],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emit = __emit;
		const { camera: activeCamera, controls, invalidate, renderer, scene } = useTres();
		const computedCamera = computed(() => props.camera || activeCamera.value);
		const computedRenderer = computed(() => renderer);
		const instance = markRaw(new TransformControls(computedCamera.value, computedRenderer.value.domElement));
		instance.addEventListener("change", () => {
			invalidate();
			emit("change");
		});
		let cacheControlsEnabled = false;
		instance.addEventListener("dragging-changed", (e) => {
			if (controls.value) if (e.value) {
				cacheControlsEnabled = controls.value.enabled;
				controls.value.enabled = false;
			} else controls.value.enabled = cacheControlsEnabled;
			invalidate();
			emit("dragging");
		});
		instance.addEventListener("mouseDown", () => {
			invalidate();
			emit("mouseDown");
		});
		instance.addEventListener("mouseUp", () => {
			invalidate();
			emit("mouseUp");
		});
		instance.addEventListener("objectChange", () => {
			invalidate();
			emit("objectChange");
		});
		const helper = markRaw(instance.getHelper());
		onMounted(() => {
			scene.value.add(helper);
		});
		onBeforeUnmount(() => {
			scene.value.remove(helper);
			helper.dispose();
			instance.detach();
			instance.disconnect();
			instance.dispose();
		});
		watch(() => props.axis, (axis) => {
			if (axis) instance.axis = axis;
			else instance.axis = null;
		}, { immediate: true });
		watch(() => props.enabled, (enabled) => {
			if (enabled) instance.enabled = true;
			else instance.enabled = false;
		}, { immediate: true });
		watch(() => props.mode, (mode) => {
			if (mode) instance.mode = mode;
			else instance.mode = "translate";
		}, { immediate: true });
		watch(() => props.object, (object) => {
			if (object) instance.attach(object);
			else instance.detach();
		}, { immediate: true });
		watch(() => props.rotationSnap, (rotationSnap) => {
			if (rotationSnap) instance.rotationSnap = rotationSnap;
			else instance.rotationSnap = null;
		}, { immediate: true });
		watch(() => props.scaleSnap, (scaleSnap) => {
			if (scaleSnap) instance.scaleSnap = scaleSnap;
			else instance.scaleSnap = null;
		}, { immediate: true });
		watch(() => props.translationSnap, (translationSnap) => {
			if (translationSnap) instance.translationSnap = translationSnap;
			else instance.translationSnap = null;
		}, { immediate: true });
		return (_ctx, _cache) => {
			return toDisplayString(null);
		};
	}
});

//#endregion
export { _sfc_main as default };
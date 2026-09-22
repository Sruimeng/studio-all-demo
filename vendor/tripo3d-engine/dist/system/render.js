import { defineSystem } from "../utils/system.js";
import { ref, watchEffect } from "vue";
import { useTresContext } from "@tresjs/core";
import { EffectComposer, OutputPass, RenderPass } from "three/examples/jsm/Addons.js";
import { Clock } from "three";

//#region src/system/render.ts
const useRenderSystem = defineSystem("render", ({ onDispose }) => {
	const { camera, renderer, scene, sizes } = useTresContext();
	const composer = new EffectComposer(renderer.instance);
	const renderPass = new RenderPass(scene.value, camera.activeCamera.value);
	const outputPass = new OutputPass();
	const pixelRatio = renderer.instance.getPixelRatio();
	composer.setPixelRatio(pixelRatio);
	watchEffect(() => {
		composer.setSize(sizes.width.value, sizes.height.value);
	});
	watchEffect(() => {
		renderPass.scene = scene.value;
	});
	watchEffect(() => {
		renderPass.camera = camera.activeCamera.value;
	});
	const task = ref([]);
	const clock = new Clock();
	renderer.replaceRenderFunction((notifyRenderSuccess) => {
		composer.passes.length = 0;
		const delta = clock.getDelta();
		const elapsed = clock.getElapsedTime();
		for (const rf of task.value) rf.render({
			composer,
			delta,
			elapsed
		});
		composer.insertPass(renderPass, 0);
		composer.addPass(outputPass);
		composer.render();
		notifyRenderSuccess();
	});
	onDispose(() => {
		task.value.length = 0;
		composer.dispose();
		renderPass.dispose();
		outputPass.dispose();
		renderer.replaceRenderFunction(() => {});
		renderer.loop.stop();
	});
	return { onRender: (render, order) => {
		task.value.push({
			order,
			render
		});
		task.value.sort((a, b) => a.order - b.order);
	} };
});

//#endregion
export { useRenderSystem };
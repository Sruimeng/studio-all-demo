import { Engine } from "../core/type.js";
import "../index.js";
import * as vue from "vue";
import { EffectComposer } from "three/examples/jsm/Addons.js";

//#region src/system/render.d.ts
type RenderFunction = (param: {
  composer: EffectComposer;
  delta: number;
  elapsed: number;
}) => void;
declare const useRenderSystem: {
  (): {
    onRender: (render: RenderFunction, order: number) => void;
    enable: boolean;
  };
  (engine: Engine): vue.ComputedRef<{
    onRender: (render: RenderFunction, order: number) => void;
    enable: boolean;
  } | undefined>;
};
//#endregion
export { RenderFunction, useRenderSystem };
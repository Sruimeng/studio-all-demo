import { CameraControls } from "../node_modules/.pnpm/camera-controls@3.1.2_three@0.183.1/node_modules/camera-controls/dist/index.js";
import * as vue from "vue";
import { GizmoOptions } from "three-viewport-gizmo";
import { OrthographicCamera, PerspectiveCamera } from "three";

//#region src/components/camera-controls-gizmo.vue.d.ts
interface Props {
  camera?: PerspectiveCamera | OrthographicCamera;
  controls?: CameraControls;
  options?: GizmoOptions;
}
declare const __VLS_export: vue.DefineComponent<Props, {}, {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, vue.PublicProps, Readonly<Props> & Readonly<{}>, {
  options: GizmoOptions;
}, {}, {}, {}, string, vue.ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
//#endregion
export { _default };
import * as vue from "vue";
import { Camera, Object3D } from "three";

//#region src/components/transform-controls.vue.d.ts
type __VLS_Props = {
  axis?: 'X' | 'Y' | 'Z' | 'XY' | 'YZ' | 'XZ' | 'XYZ';
  camera?: Camera;
  enabled?: boolean;
  mode?: 'translate' | 'rotate' | 'scale';
  object?: Object3D;
  rotationSnap?: number;
  scaleSnap?: number;
  translationSnap?: number;
};
declare const __VLS_export: vue.DefineComponent<__VLS_Props, {}, {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {
  dragging: (...args: any[]) => void;
  change: (...args: any[]) => void;
  mouseDown: (...args: any[]) => void;
  mouseUp: (...args: any[]) => void;
  objectChange: (...args: any[]) => void;
}, string, vue.PublicProps, Readonly<__VLS_Props> & Readonly<{
  onDragging?: ((...args: any[]) => any) | undefined;
  onChange?: ((...args: any[]) => any) | undefined;
  onMouseDown?: ((...args: any[]) => any) | undefined;
  onMouseUp?: ((...args: any[]) => any) | undefined;
  onObjectChange?: ((...args: any[]) => any) | undefined;
}>, {
  enabled: boolean;
}, {}, {}, {}, string, vue.ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
//#endregion
export { _default };
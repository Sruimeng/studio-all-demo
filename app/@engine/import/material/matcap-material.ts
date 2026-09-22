import { DoubleSide, MeshMatcapMaterial, type MeshMatcapMaterialParameters, type Texture, TextureLoader } from 'three';
import matcap from './matcap.webp';

declare global {
  interface Window {
    _matcapTexture?: Texture;
  }
}

const loader = new TextureLoader();

export class MatcapMaterial extends MeshMatcapMaterial {
  // 原因：https://github.com/mrdoob/three.js/pull/31916
  override wireframe = false;
  constructor(parameters?: MeshMatcapMaterialParameters) {
    super(parameters);
    if (import.meta.server) return;
    // flatShading 由 material system 根据模型纹理与用户选择统一管理；异步回调只更新资源。
    if (window._matcapTexture) {
      this.matcap = window._matcapTexture;
      this.needsUpdate = true;
      this.side = DoubleSide;
    } else {
      loader.load(matcap, (texture) => {
        this.matcap = texture;
        window._matcapTexture = texture;
        this.needsUpdate = true;
        this.side = DoubleSide;
      });
    }
  }
}

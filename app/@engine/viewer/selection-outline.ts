import { BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial, Scene, ShaderMaterial, Vector2, Vector4, WebGLRenderTarget, type Camera, type Object3D, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Draw the visible selection boundary, including silhouettes of closed parts, without tinting their surfaces. */
export function createSelectionOutline() {
  const scene = new Scene();
  const maskMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const target = new WebGLRenderTarget(1, 1, { depthBuffer: true });
  const uniforms = { mask: { value: target.texture }, pixelStep: { value: new Vector2(1, 1) } };
  const material = new ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D mask;
      uniform vec2 pixelStep;
      varying vec2 vUv;
      float boundary(float radius) {
        float center = texture2D(mask, vUv).r;
        float difference = 0.0;
        for (int i = 0; i < 8; i++) {
          float angle = float(i) * 0.78539816339;
          vec2 offset = vec2(cos(angle), sin(angle)) * pixelStep * radius;
          difference = max(difference, abs(texture2D(mask, vUv + offset).r - center));
        }
        return smoothstep(0.1, 0.7, difference);
      }
      void main() {
        float border = boundary(2.6);
        float line = boundary(1.4);
        float alpha = max(border, line);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(0.08, 0.085, 0.10), vec3(1.0, 0.855, 0.341), line), alpha);
      }`,
  });
  const quad = new FullScreenQuad(material);
  let mesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;
  let source: Float32Array | null = null;
  let active = false;
  const viewport = new Vector4(), scissor = new Vector4(), clearColor = new Color();

  function update(positions: Float32Array | undefined, selection: Uint32Array | undefined) {
    active = !!positions && !!selection?.length;
    if (!positions) {
      mesh?.removeFromParent(); mesh?.geometry.dispose(); mesh = null; source = null;
      return;
    }
    if (!active) return;
    if (positions !== source) {
      mesh?.removeFromParent(); mesh?.geometry.dispose();
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.setAttribute('color', new BufferAttribute(new Uint8Array(positions.length), 3, true));
      mesh = new Mesh(geometry, maskMaterial); mesh.matrixAutoUpdate = false;
      scene.add(mesh); source = positions;
    }
    const colors = mesh!.geometry.getAttribute('color') as BufferAttribute;
    (colors.array as Uint8Array).fill(0);
    for (const face of selection!) colors.array.fill(255, face * 9, face * 9 + 9);
    colors.needsUpdate = true;
  }

  function render(renderer: WebGLRenderer, camera: Camera, mount: Object3D, width: number, height: number) {
    if (!active || !mesh || width <= 0 || height <= 0) return;
    const ratio = renderer.getPixelRatio();
    target.setSize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
    uniforms.pixelStep.value.set(1 / width, 1 / height);
    mount.updateWorldMatrix(true, false); mesh.matrix.copy(mount.matrixWorld);
    const previousTarget = renderer.getRenderTarget(), autoClear = renderer.autoClear;
    const scissorTest = renderer.getScissorTest(), clearAlpha = renderer.getClearAlpha();
    renderer.getViewport(viewport); renderer.getScissor(scissor); renderer.getClearColor(clearColor);
    try {
      // Unselected faces still write depth, so hidden selections never show through the model.
      renderer.setRenderTarget(target); renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 1); renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.setRenderTarget(previousTarget); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.autoClear = false; quad.render(renderer);
    } finally {
      renderer.setRenderTarget(previousTarget); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.setClearColor(clearColor, clearAlpha); renderer.autoClear = autoClear;
    }
  }

  function dispose() { mesh?.geometry.dispose(); maskMaterial.dispose(); target.dispose(); material.dispose(); quad.dispose(); }
  return { update, render, dispose };
}

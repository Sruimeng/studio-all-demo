/** Keep hover requests read-only, bounded to one in flight, and discard outdated results. */
export function createFillPreview(load: (face: number) => Promise<Uint32Array>, publish: (faces: Uint32Array) => void) {
  let desired: number | null = null;
  let version = 0;
  let pending = false;
  let faces: Uint32Array = new Uint32Array();
  function show(value: Uint32Array) { faces = value; publish(value); }
  async function run() {
    if (pending) return;
    pending = true;
    try {
      while (desired !== null) {
        if (faces.includes(desired)) break;
        const requestVersion = version, face = desired;
        let result: Uint32Array;
        try { result = await load(face); }
        catch { if (requestVersion === version) break; else continue; }
        if (requestVersion !== version) continue;
        show(result); break;
      }
    } finally { pending = false; }
  }
  function hover(face: number | null) {
    if (desired === face) return;
    desired = face; version++;
    if (face !== null && faces.includes(face)) return;
    show(new Uint32Array());
    if (face !== null) void run();
  }
  function clear() { desired = null; version++; show(new Uint32Array()); }
  return { hover, clear };
}

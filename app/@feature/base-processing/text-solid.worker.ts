import createManifold from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { joinBaseText } from './text-solid';
import type { TextSolidRequest, TextSolidResponse } from './text-solid-client';
const scope = self as unknown as { onmessage: ((event: MessageEvent<TextSolidRequest>) => void) | null; postMessage: (message: TextSolidResponse, transfer?: Transferable[]) => void };
scope.onmessage = async event => {
  const { id, base, text } = event.data;
  try {
    const module = await createManifold({ locateFile: () => wasmUrl }); module.setup();
    const result = joinBaseText(module, base, text);
    scope.postMessage({ id, result }, [result.positions.buffer as ArrayBuffer, result.indices.buffer as ArrayBuffer, result.faceMaterials.buffer as ArrayBuffer]);
  } catch (error) { scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
};

import { cutMesh } from './geometry';
import type { CutRequest, CutResponse } from './types';
const scope = self as unknown as { onmessage: ((event: MessageEvent<CutRequest>) => void) | null; postMessage: (message: CutResponse, transfer?: Transferable[]) => void };
scope.onmessage = event => {
  const { id, mesh, plane } = event.data;
  try {
    const result = cutMesh(mesh, plane);
    scope.postMessage({ id, result }, [result.positions.buffer as ArrayBuffer, result.indices.buffer as ArrayBuffer]);
  } catch (error) { scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
};

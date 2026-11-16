import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSite } from '../app/@base/site/config';
import handler from '../api/materials';
import { emptyLibrary } from '../app/@feature/materials/sync-contract';
import { supplierMaterials, cloneMaterial } from '../app/@feature/materials/supplier';

vi.mock('~/@base/site', () => ({ site: createSite('SUNLU'), includesVendor: (vendor: string) => vendor === 'SUNLU' }));
const sha = 'a'.repeat(40); const library = () => emptyLibrary('SUNLU');
const file = (value = library()) => new Response(JSON.stringify({ sha, size: 100, content: Buffer.from(JSON.stringify(value)).toString('base64') }));
async function call(method = 'GET', body?: unknown, extraHeaders = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as IncomingMessage;
  req.method = method; req.headers = { host: 'sunlu.example', origin: 'https://sunlu.example', 'content-type': 'application/json', ...extraHeaders };
  let output = ''; const headers: Record<string, unknown> = {};
  const res = { statusCode: 0, setHeader: (key: string, value: unknown) => { headers[key] = value; }, end: (value: string) => { output = value; } } as unknown as ServerResponse;
  await handler(req, res); return { status: res.statusCode, body: JSON.parse(output), headers, raw: output };
}
beforeEach(() => { vi.stubEnv('MATERIAL_GITHUB_TOKEN', 'test-only-secret'); vi.stubEnv('MATERIAL_GITHUB_REPOSITORY', 'Sruimeng/studio-material-data'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('vendor GitHub material API', () => {
  it('returns the fixed vendor file without a write or token disclosure', async () => {
    const fetcher = vi.fn().mockResolvedValue(file()); vi.stubGlobal('fetch', fetcher);
    const result = await call(); expect(result.status).toBe(200); expect(result.body).toEqual({ sha, library: library() }); expect(result.headers['Cache-Control']).toBe('no-store'); expect(result.raw).not.toContain('test-only-secret');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0]![0]).toContain('/materials/sunlu.json?ref=main');
  });
  it('rejects cross-origin requests and other vendor data before accessing GitHub', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await call('PUT', { sha, library: library() }, { origin: 'https://other.example' })).status).toBe(403);
    expect((await call('PUT', { sha, library: { ...library(), vendor: 'Polymaker' } })).status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects stale SHA and does not commit unchanged data', async () => {
    const fetcher = vi.fn().mockImplementation(async () => file()); vi.stubGlobal('fetch', fetcher);
    expect((await call('PUT', { sha: 'b'.repeat(40), library: library() })).status).toBe(409);
    expect((await call('PUT', { sha, library: library() })).status).toBe(200); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('writes preview overrides with immutable catalog and explicit before/after modifications', async () => {
    const edit = cloneMaterial(supplierMaterials[0]!); edit.hex = '#123456'; edit.supplier!.catalogHex = '#000000';
    const fetcher = vi.fn().mockResolvedValueOnce(file()).mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: 'b'.repeat(40) } }))); vi.stubGlobal('fetch', fetcher);
    const result = await call('PUT', { sha, library: { ...library(), supplierEdits: [edit] } }); expect(result.status).toBe(200);
    const payload = JSON.parse(fetcher.mock.calls[1]![1].body); const saved = JSON.parse(Buffer.from(payload.content, 'base64').toString());
    expect(payload.sha).toBe(sha); expect(saved.vendor).toBe('SUNLU'); expect(saved.supplierEdits[0].supplier).toEqual(supplierMaterials[0]!.supplier); expect(saved.supplierModifications[0].changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'hex', source: '#FFFFFF', value: '#123456' })]));
  });
  it('returns 409 on a GitHub compare-and-swap race and sanitizes GitHub failures', async () => {
    const edit = cloneMaterial(supplierMaterials[0]!); edit.hex = '#123456';
    const fetcher = vi.fn().mockResolvedValueOnce(file()).mockResolvedValueOnce(new Response('{}', { status: 409 })); vi.stubGlobal('fetch', fetcher);
    expect((await call('PUT', { sha, library: { ...library(), supplierEdits: [edit] } })).status).toBe(409);
    fetcher.mockRejectedValueOnce(new Error('test-only-secret'));
    const result = await call(); expect(result.status).toBe(502); expect(result.raw).not.toContain('test-only-secret');
  });
  it('rejects oversized requests and missing configuration explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await call('PUT', {}, { 'content-length': String(4 * 1024 * 1024) })).status).toBe(413);
    vi.stubEnv('MATERIAL_GITHUB_TOKEN', ''); expect((await call()).status).toBe(503);
  });
});

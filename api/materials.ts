import type { IncomingMessage, ServerResponse } from 'node:http';
import { site } from '../app/@base/site';
import { libraryJSON, parseLibrary, supplierModification } from '../app/@feature/materials/server';

const limit = 3 * 1024 * 1024;
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  try {
    const vendor = site.vendor;
    if (!vendor) throw new HttpError(404, 'This site has no shared material library');
    if (!['GET', 'PUT'].includes(req.method ?? '')) { res.setHeader('Allow', 'GET, PUT'); throw new HttpError(405, 'Method not allowed'); }
    const token = process.env.MATERIAL_GITHUB_TOKEN;
    const repository = process.env.MATERIAL_GITHUB_REPOSITORY;
    if (!token || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new HttpError(503, 'Material storage is not configured');
    const branch = process.env.MATERIAL_GITHUB_BRANCH ?? 'main';
    const url = `https://api.github.com/repos/${repository}/contents/materials/${vendor.toLowerCase()}.json`;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (req.method === 'PUT') {
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (!origin || !host || new URL(origin).host !== host || req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-origin writes are not allowed');
      if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'JSON required');
    }
    const read = async () => {
      const response = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new HttpError(response.status === 404 ? 503 : 502, 'Could not read the GitHub material file');
      const file = await response.json() as { sha: string; content?: string; size: number };
      if (file.size > limit) throw new HttpError(502, 'Material file is too large');
      if (!file.content) {
        const blob = await fetch(`https://api.github.com/repos/${repository}/git/blobs/${file.sha}`, { headers, signal: AbortSignal.timeout(15000) });
        if (!blob.ok) throw new HttpError(502, 'Could not read the GitHub material file');
        file.content = (await blob.json() as { content: string }).content;
      }
      if (!file.content) throw new HttpError(502, 'Invalid material file');
      return { sha: file.sha, library: parseLibrary(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), vendor) };
    };
    if (req.method === 'GET') return send(200, await read());
    if (Number(req.headers['content-length'] ?? 0) > limit) throw new HttpError(413, 'Material library must be smaller than 3 MB');
    let size = 0; const chunks: Buffer[] = [];
    for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > limit) throw new HttpError(413, 'Material library must be smaller than 3 MB'); chunks.push(bytes); }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
    if (!input || typeof input.sha !== 'string' || !/^[a-f0-9]{40}$/.test(input.sha)) throw new HttpError(400, 'A GitHub file revision is required');
    let library;
    try { library = parseLibrary(input.library, vendor); } catch { throw new HttpError(400, 'Invalid material library or supplier'); }
    const current = await read();
    if (current.sha !== input.sha) throw new HttpError(409, 'Material library changed on another device');
    if (libraryJSON(current.library) === libraryJSON(library)) return send(200, current);
    const data = { ...library, updatedAt: new Date().toISOString(), supplierModifications: library.supplierEdits.flatMap(item => { const change = supplierModification(item); return change ? [change] : []; }) };
    const bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n');
    if (bytes.length > limit) throw new HttpError(413, 'Material library must be smaller than 3 MB');
    const content = bytes.toString('base64');
    const response = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Save ${vendor} materials`, sha: current.sha, content, branch }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new HttpError([409, 422].includes(response.status) ? 409 : 502, response.status === 409 || response.status === 422 ? 'Material library changed on another device' : 'Could not save material data to GitHub');
    const result = await response.json() as { content: { sha: string } };
    return send(200, { sha: result.content.sha, library });
  } catch (error) {
    return send(error instanceof HttpError ? error.status : 502, { error: error instanceof HttpError ? error.message : 'Material storage is temporarily unavailable' });
  }
}

import { supplierMaterial, materialProblem } from './supplier';
import { validateMaterial } from './catalog';
import type { MaterialRecord, SupplierProfile } from './types';

const defaults = { base_weight: 1, base_color: [0.8, 0.8, 0.8], base_metalness: 0, base_diffuse_roughness: 0, specular_weight: 1, specular_color: [1, 1, 1], specular_roughness: 0.3, specular_ior: 1.5, specular_roughness_anisotropy: 0, coat_weight: 0, transmission_weight: 0, subsurface_weight: 0, fuzz_weight: 0, thin_film_weight: 0, emission_luminance: 0, geometry_opacity: 1 };
interface Prim { name: string; body: string }
const scalar = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const extraInputs = `coat_color coat_darkening coat_ior coat_roughness coat_roughness_anisotropy emission_color fuzz_color fuzz_roughness geometry_coat_normal geometry_coat_tangent geometry_normal geometry_tangent geometry_thin_walled subsurface_color subsurface_radius subsurface_radius_scale subsurface_scatter_anisotropy thin_film_ior thin_film_thickness transmission_color transmission_depth transmission_dispersion_abbe_number transmission_dispersion_scale transmission_scatter transmission_scatter_anisotropy`;
const knownInputs = new Set([...Object.keys(defaults), ...extraInputs.split(' ')]);
const stripComments = (value: string) => value.replace(/#[^\n]*|"(?:\\.|[^"\\])*"/g, token => token.startsWith('#') ? ' ' : token);
function prims(text: string, kind: string): Prim[] {
  const result: Prim[] = [];
  const tokens = /#[^\n]*|"(?:\\.|[^"\\])*"|\b(def|over|class)\s+(\w+)\s+("(?:\\.|[^"\\])*")/g;
  for (let match; (match = tokens.exec(text));) {
    if (!match[1] || match[2] !== kind) continue;
    if (match[1] !== 'def') throw new Error('Only self-contained materials are supported / 仅支持独立材质定义');
    const braces = /#[^\n]*|"(?:\\.|[^"\\])*"|[{}()]/g;
    braces.lastIndex = tokens.lastIndex;
    let depth = 0, metadata = 0, start = -1, end = -1;
    for (let token; (token = braces.exec(text));) {
      if (start < 0 && token[0] === '(') metadata++;
      if (start < 0 && token[0] === ')') metadata--;
      if (metadata) continue;
      if (token[0] === '{') { if (start < 0) start = token.index; depth++; }
      if (token[0] === '}' && --depth === 0) { end = token.index; break; }
    }
    if (start < 0 || end < 0) throw new Error('Incomplete USDA prim / USDA 定义不完整');
    result.push({ name: JSON.parse(match[3]!), body: text.slice(start + 1, end) });
    tokens.lastIndex = end + 1;
  }
  return result;
}

export async function importUSDAMaterials(file: File): Promise<MaterialRecord[]> {
  if (!/\.usda$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw new Error('Choose a USDA file under 20 MB / 请选择 20MB 内的 USDA 文件');
  const bytes = await file.arrayBuffer();
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!/^\uFEFF?#usda 1\.0(?:\r?\n|$)/.test(text)) throw new Error('Invalid USDA header / USDA 文件头无效');
  const syntax = text.replace(/#[^\n]*|"(?:\\.|[^"\\])*"/g, '');
  if (/@|\b(?:references|payload|subLayers|inherits|specializes|variantSet|variants)\b/.test(syntax)) throw new Error('External assets or composed materials are unsupported / 暂不支持外部资源或组合材质');
  const materials = prims(text, 'Material');
  if (!materials.length || materials.length > 100) throw new Error('Expected 1–100 materials / 文件需包含 1–100 个材质');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  return materials.map(({ name, body }) => {
    const shaders = prims(stripComments(body), 'Shader').filter(shader => /\binfo:id\s*=\s*"ND_open_pbr_surface_surfaceshader"/.test(shader.body));
    if (shaders.length !== 1) throw new Error(`${name}: expected one OpenPBR shader / 需要一个 OpenPBR 节点`);
    const shader = shaders[0]!;
    const output = /outputs:mtlx:surface\.connect\s*=\s*<([^>]+)>/.exec(stripComments(body))?.[1];
    if (!output?.endsWith(`/${name}/${shader.name}.outputs:surface`)) throw new Error(`${name}: OpenPBR output is not bound / OpenPBR 输出未绑定`);
    const parameters: SupplierProfile['source']['parameters'] = structuredClone(defaults);
    const clean = shader.body.replace(/#[^\n]*|"(?:\\.|[^"\\])*"/g, '');
    const inputs = [...clean.matchAll(/\binputs:(\w+)(\.[\w:]+)?/g)];
    const seen = new Set<string>();
    for (const input of inputs) {
      const key = input[1]!;
      if (!knownInputs.has(key)) throw new Error(`${name}: unsupported input ${key} / 暂不支持此输入`);
      if (seen.has(key)) throw new Error(`${name}: duplicate input ${key}`);
      seen.add(key);
      if (input[2]) {
        if (key === 'geometry_tangent' && input[2] === '.connect') continue;
        throw new Error(`${name}: connected input ${key} / 暂不支持连接输入`);
      }
      const tail = clean.slice(input.index! + input[0].length);
      if (!/^\s*=/.test(tail)) continue;
      const value = /^\s*=\s*(\([^)]*\)|[^\s;)]+)(?=\s|;|$)/.exec(tail)?.[1];
      const parts = value?.startsWith('(') ? value.slice(1, -1).split(',').map(part => part.trim()) : null;
      if (!value || (parts ? parts.length !== 3 || parts.some(part => !scalar.test(part)) : !/^(true|false)$/.test(value) && !scalar.test(value))) throw new Error(`${name}: invalid input ${key}`);
      const parsed = value.startsWith('(') ? value.slice(1, -1).split(',').map(Number) : /^(true|false)$/.test(value) ? value === 'true' : Number(value);
      if (typeof parsed !== 'boolean' && (Array.isArray(parsed) ? parsed.length !== 3 || parsed.some(v => !Number.isFinite(v)) : !Number.isFinite(parsed))) throw new Error(`${name}: invalid input ${key}`);
      parameters[key] = parsed;
    }
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = parameters[key];
      if (Array.isArray(fallback) ? !Array.isArray(value) || value.length !== 3 : typeof value !== 'number') throw new Error(`${name}: invalid input type ${key}`);
    }
    for (const key of ['geometry_normal', 'geometry_coat_normal', 'geometry_coat_tangent', 'geometry_tangent']) {
      if (key in parameters) throw new Error(`${name}: unsupported input ${key}`);
    }
    const color = parameters.base_color;
    if (!Array.isArray(color) || color.length !== 3 || color.some(v => v < 0)) throw new Error(`${name}: invalid base color`);
    if (parameters.geometry_thin_walled || parameters.coat_roughness_anisotropy) throw new Error(`${name}: unsupported surface geometry`);
    const issues = ['source-color-space-unknown'];
    if (color.some(v => v > 1)) issues.push('base-color-outside-unit-range');
    const profile: SupplierProfile = {
      vendor: '', sku: name, product: '', colorNameEN: '', colorNameCN: '', materialType: '', catalogHex: null, pantone: null, d65Lab: null, status: 'imported', origin: 'local-usda', issues,
      source: { spreadsheet: '', row: null, file: file.name, sha256: hash, materialName: name, colorSpace: 'unknown', parameters, materialUSDA: body },
    };
    const material = { ...supplierMaterial(profile), id: crypto.randomUUID(), overrides: { colorMode: 'linear-srgb' as const } };
    const problem = validateMaterial(material, []) || materialProblem(material);
    if (problem) throw new Error(`${name}: ${problem}`);
    return material;
  });
}

import { analyze as analyzeCore } from './vendor/quantize.js';
import { commit as commitCore } from './vendor/commit.js';
import { inputFingerprint, analysisIntegrity } from './src/fingerprint.js';
import { QuantizationError, callbacks, fail, validateInput, validateAnalysis, validateCount, validateMesh } from './src/validate.js';

export { QuantizationError };
export const DEFAULT_DISTANCE_MATRIX_BYTES = 128 * 1024 * 1024;

export function analyze(input, options = {}) {
  validateInput(input); callbacks(options);
  const budget = options.maxDistanceMatrixBytes === undefined ? DEFAULT_DISTANCE_MATRIX_BYTES : options.maxDistanceMatrixBytes;
  if (!Number.isSafeInteger(budget) || budget <= 0) fail('maxDistanceMatrixBytes must be a positive finite safe integer.');
  const fingerprint = inputFingerprint(input);
  let result;
  try {
    result = analyzeCore(input.triUV, input.triWorld, input.texture, input.flipY, options.log, options.progress, budget);
  } catch (error) {
    if (error.code === 'ERR_DISTANCE_MATRIX_BUDGET') throw new QuantizationError(error.code, error.message);
    throw error;
  }
  if (fingerprint !== inputFingerprint(input)) fail('Input changed during analysis.', 'ERR_INPUT_MISMATCH');
  const analysis = { ...result, version: 1, inputFingerprint: fingerprint, flipY: input.flipY, faceCount: input.triWorld.length / 9 };
  analysis.integrity = analysisIntegrity(analysis);
  validateAnalysis(analysis);
  return analysis;
}

export function getLevel(analysis, colorCount) {
  validateAnalysis(analysis); validateCount(analysis, colorCount);
  return structuredClone(analysis.levels[colorCount - 1]);
}

export function renderPreview(analysis, colorCount) {
  const level = getLevel(analysis, colorCount);
  const data = new Uint8Array(analysis.width * analysis.height * 4);
  for (let i = 0; i < analysis.leafIndexMap.length; i++) {
    const leaf = analysis.leafIndexMap[i];
    if (leaf === 255) continue;
    const rgb = level.clusters[level.leafToCluster[leaf]].rgb;
    data.set(rgb, i * 4); data[i * 4 + 3] = 255;
  }
  return { width: analysis.width, height: analysis.height, data, palette: level.clusters, colorCount: level.K };
}

export function commit(input, analysis, options) {
  validateInput(input); validateAnalysis(analysis); callbacks(options);
  validateCount(analysis, options.colorCount);
  if (inputFingerprint(input) !== analysis.inputFingerprint || input.texture.width !== analysis.width || input.texture.height !== analysis.height || input.flipY !== analysis.flipY || input.triWorld.length / 9 !== analysis.faceCount) fail('Analysis belongs to different geometry, UVs, texture or flipY.', 'ERR_INPUT_MISMATCH');
  const result = commitCore(input.triUV, input.triWorld, input.texture, analysis, options.colorCount, input.flipY, options.log, options.progress);
  validateMesh(result, options.colorCount);
  return result;
}

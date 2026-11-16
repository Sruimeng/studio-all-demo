import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { analyze, commit, getLevel, renderPreview, QuantizationError } from '@tripo3d/color-quantization';
import { analyze as upstreamAnalyze, srgbToLab } from '../vendor/quantize.js';
import { commit as upstreamCommit } from '../vendor/commit.js';
import { sha256 } from '../src/fingerprint.js';
import { validateMesh } from '../src/validate.js';
import { planeFixture, twoColorFixture } from './fixtures.mjs';

const code = expected => error => error.code === expected;

test('streaming SHA-256 agrees with Node over padding and block boundaries', () => {
  for (const length of [0, 1, 55, 56, 63, 64, 65, 1000]) {
    const data = Uint8Array.from({ length }, (_, i) => i % 251);
    assert.equal(sha256([data.subarray(0, 17), data.subarray(17)]), createHash('sha256').update(data).digest('hex'));
  }
});

test('single-color analytic golden has one leaf, full coverage, unchanged mesh', () => {
  const input = planeFixture('solid', { width: 8, height: 8, cells: 1 }).input;
  const a = analyze(input);
  assert.deepEqual(a.leafLab, [srgbToLab(255, 0, 0).map(Math.fround)]);
  assert.deepEqual(a.leafWeight, [1]);
  assert.deepEqual(a.merges, []);
  assert.equal(a.maxSelectableColorCount, 1);
  assert.equal(a.totalCovered, 64);
  assert.ok(a.leafIndexMap.every(v => v === 0));
  assert.equal(getLevel(a, 1).clusters[0].hex, '#ff0000');
  const result = commit(input, a, { colorCount: 1 });
  assert.deepEqual([...result.P], [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  assert.deepEqual([...result.T], [0, 1, 2, 0, 2, 3]);
  assert.deepEqual([...result.lab], [0, 0]);
});

test('public wrapper preserves vendored numerical analysis and commit on tiny fixtures', () => {
  for (const input of [twoColorFixture(), planeFixture('flat-regions', { cells: 2, width: 8, height: 8 }).input]) {
    for (const flipY of [false, true]) {
      const source = { ...input, flipY };
      const a = analyze(source);
      const raw = upstreamAnalyze(source.triUV, source.triWorld, source.texture, flipY);
      for (const key of Object.keys(raw)) assert.deepEqual(a[key], raw[key], key);
      for (let k = 1; k <= a.maxSelectableColorCount; k++) {
        const result = commit(source, a, { colorCount: k });
        assert.deepEqual(result, upstreamCommit(source.triUV, source.triWorld, source.texture, raw, k, flipY));
        validateMesh(result, k);
      }
    }
  }
});

test('all cached K levels map leaves and preview without mutating analysis', () => {
  const input = twoColorFixture(), a = analyze(input), before = structuredClone(a);
  assert.equal(a.maxSelectableColorCount, 2);
  assert.deepEqual(a.leafLab, [srgbToLab(0, 0, 255).map(Math.fround), srgbToLab(255, 0, 0).map(Math.fround)]);
  assert.deepEqual(a.leafWeight, [0.5, 0.5]);
  assert.ok(a.leafIndexMap.includes(255));
  for (const k of [2, 1, 2]) {
    const l = getLevel(a, k), preview = renderPreview(a, k);
    assert.equal(l.K, k); assert.equal(l.clusters.length, k);
    for (let i = 0; i < a.leafIndexMap.length; i++) {
      const leaf = a.leafIndexMap[i], pixel = [...preview.data.subarray(i * 4, i * 4 + 4)];
      assert.deepEqual(pixel, leaf === 255 ? [0, 0, 0, 0] : [...l.clusters[l.leafToCluster[leaf]].rgb, 255]);
    }
    l.leafToCluster.fill(99); preview.palette[0].rgb.fill(0);
    commit(input, a, { colorCount: k });
  }
  assert.deepEqual(a, before);
});

test('same-size geometry, UV, texture and flipY mismatches cannot commit', () => {
  const input = twoColorFixture(), a = analyze(input);
  for (const mutate of [i => { i.triWorld[0] += 0.01; }, i => { i.triUV[0] += 0.01; }, i => { i.texture.data[0] ^= 1; }, i => { i.flipY = true; }]) {
    const other = structuredClone(input); mutate(other);
    assert.throws(() => commit(other, a, { colorCount: 1 }), code('ERR_INPUT_MISMATCH'));
  }
  assert.doesNotThrow(() => commit(structuredClone(input), structuredClone(a), { colorCount: 1 }));
});

test('rejects malformed analysis before indexing or replaying merges', () => {
  const a = analyze(twoColorFixture());
  for (const mutate of [
    a => { a.leafIndexMap[0] = 99; }, a => { a.leafLab[0][0] = NaN; },
    a => { a.merges[0].fromLeaf = 99; }, a => { a.levels[0].leafToCluster[0] = 20; },
    a => { a.totalCovered++; }, a => { a.leafWeight[0]++; }, a => { a.inputFingerprint = '0'.repeat(64); },
  ]) {
    const other = structuredClone(a); mutate(other);
    assert.throws(() => getLevel(other, 1), code('ERR_INVALID_ANALYSIS'));
  }
  assert.throws(() => renderPreview(null, 1), code('ERR_INVALID_ANALYSIS'));
});

test('rejects invalid counts rather than truncating or clamping', () => {
  const input = twoColorFixture(), a = analyze(input);
  for (const k of [0, -1, 1.5, NaN, Infinity, '1', 3]) {
    assert.throws(() => getLevel(a, k), code('ERR_COLOR_COUNT'));
    assert.throws(() => renderPreview(a, k), code('ERR_COLOR_COUNT'));
    assert.throws(() => commit(input, a, { colorCount: k }), code('ERR_COLOR_COUNT'));
  }
});

test('input boundary rejects dimensions, buffers, nonfinite values, degenerate faces and repeat UV', () => {
  for (const mutate of [
    i => { i.texture.width = 0; }, i => { i.texture.width = 1.5; }, i => { i.texture.height = Infinity; },
    i => { i.texture.data = new Uint8Array(1); }, i => { i.texture.data = new Uint8ClampedArray(192); },
    i => { i.triWorld = [...i.triWorld]; }, i => { i.triWorld = new Float32Array(0); },
    i => { i.triWorld[0] = Infinity; }, i => { i.triWorld.fill(0); }, i => { i.triWorld.fill(1e30); },
    i => { i.triUV = new Float32Array(6); }, i => { i.triUV[0] = NaN; }, i => { i.triUV[0] = -0.01; },
    i => { i.triUV[0] = 1.01; }, i => { delete i.flipY; },
  ]) {
    const input = twoColorFixture(); mutate(input);
    assert.throws(() => analyze(input), code('ERR_INVALID_INPUT'));
  }
});

test('one premerge matrix budget preserves outputs or fails with coded resource error', () => {
  const input = twoColorFixture();
  assert.throws(() => analyze(input, { maxDistanceMatrixBytes: 31 }), error => error instanceof QuantizationError && error.code === 'ERR_DISTANCE_MATRIX_BUDGET');
  assert.deepEqual(analyze(input, { maxDistanceMatrixBytes: 32 }), analyze(input));
  for (const budget of [null, 0, -1, 1.5, Infinity, NaN, '128']) assert.throws(() => analyze(input, { maxDistanceMatrixBytes: budget }), code('ERR_INVALID_INPUT'));
});

test('callbacks surface stages and logs; malformed mesh results are rejected', () => {
  const stages = [], logs = [], input = twoColorFixture();
  const a = analyze(input, { progress: (s, p) => stages.push([s, p]), log: m => logs.push(m) });
  const result = commit(input, a, { colorCount: 1, progress: (s, p) => stages.push([s, p]), log: m => logs.push(m) });
  assert.ok(stages.length > 10 && stages.every(([s, p]) => typeof s === 'string' && p >= 0 && p <= 1));
  assert.ok(logs.length > 4);
  for (const mutate of [r => { r.P[0] = NaN; }, r => { r.T[0] = -1; }, r => { r.lab[0] = 99; }, r => { r.T[1] = r.T[0]; }, r => { r.palette[0].rgb[0] = 999; }]) {
    const other = structuredClone(result); mutate(other);
    assert.throws(() => validateMesh(other, 1), code('ERR_INVALID_RESULT'));
  }
  assert.throws(() => analyze(input, { progress: 1 }), code('ERR_INVALID_INPUT'));
});

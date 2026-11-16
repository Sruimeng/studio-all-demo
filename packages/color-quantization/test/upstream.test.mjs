import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { analyze, commit } from '@tripo3d/color-quantization';
import { planeFixture, twoColorFixture } from './fixtures.mjs';

// Optional independent oracle; default tests and the distributed package need no checkout.
const checkout = process.env.CQ_UPSTREAM;
test('independent pinned upstream equivalence on accepted fixtures', { skip: !checkout }, async () => {
  const quantizeSource = await readFile(resolve(checkout, 'web/js/quantize.js'), 'utf8');
  const quantizeURL = 'data:text/javascript;base64,' + Buffer.from(quantizeSource).toString('base64');
  const commitSource = (await readFile(resolve(checkout, 'web/js/commit.js'), 'utf8')).replace("'./quantize.js'", JSON.stringify(quantizeURL));
  const oracle = await import(quantizeURL);
  const baker = await import('data:text/javascript;base64,' + Buffer.from(commitSource).toString('base64'));
  const fixtures = [twoColorFixture(), ...['solid', 'flat-regions', 'smooth-shading', 'small-distinctive-color'].map(kind => planeFixture(kind, { width: 16, height: 16, cells: 4 }).input)];
  for (const input of fixtures) for (const flipY of [false, true]) {
    const source = { ...input, flipY }, a = analyze(source);
    const expected = oracle.analyze(input.triUV, input.triWorld, input.texture, flipY);
    for (const key of Object.keys(expected)) assert.deepEqual(a[key], expected[key], key);
    for (const k of new Set([1, a.maxSelectableColorCount])) assert.deepEqual(commit(source, a, { colorCount: k }), baker.commit(input.triUV, input.triWorld, input.texture, expected, k, flipY));
  }
});

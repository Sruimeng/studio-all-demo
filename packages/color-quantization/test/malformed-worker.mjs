globalThis.addEventListener('message', ({ data }) => {
  globalThis.postMessage({ id: data.input.mode === 'unknown-id' ? data.id + 1 : data.id, type: 'result', command: data.type, result: {} });
});

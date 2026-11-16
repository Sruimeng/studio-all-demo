import { analyze, getLevel, renderPreview, commit } from './index.js';
import { QuantizationError } from './src/validate.js';

let input = null, analysis = null;
const send = message => globalThis.postMessage(message);
globalThis.addEventListener('message', ({ data }) => {
  const id = data?.id;
  try {
    if (!Number.isSafeInteger(id) || id < 1 || typeof data.type !== 'string') throw new QuantizationError('ERR_PROTOCOL', 'Request needs a positive integer id and a command type.');
    const log = message => send({ id, type: 'log', message });
    const progress = (stage, fraction) => send({ id, type: 'progress', stage, fraction });
    let result;
    if (data.type === 'analyze') {
      input = null; analysis = null;
      if (data.options !== undefined && (!data.options || typeof data.options !== 'object' || Array.isArray(data.options))) throw new QuantizationError('ERR_INVALID_INPUT', 'Analyze options must be an object.');
      result = analyze(data.input, { ...data.options, log, progress });
      input = data.input; analysis = result;
    } else {
      if (!analysis) throw new QuantizationError('ERR_SEQUENCE', 'Analyze input before selecting, previewing or committing.');
      switch (data.type) {
        case 'getLevel': result = getLevel(analysis, data.colorCount); break;
        case 'preview': result = renderPreview(analysis, data.colorCount); break;
        case 'commit': result = commit(input, analysis, { colorCount: data.colorCount, log, progress }); break;
        default: throw new QuantizationError('ERR_PROTOCOL', `Unknown command: ${data.type}`);
      }
    }
    // Keep cached input and analysis owned by the worker; responses are copies.
    send({ id, type: 'result', command: data.type, result });
  } catch (error) {
    send({ id, type: 'error', code: error.code || 'ERR_QUANTIZATION', message: error instanceof Error ? error.message : String(error) });
  }
});

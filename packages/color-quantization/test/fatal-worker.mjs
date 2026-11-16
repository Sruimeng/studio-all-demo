globalThis.addEventListener('message', () => { throw new Error('Intentional worker failure'); });

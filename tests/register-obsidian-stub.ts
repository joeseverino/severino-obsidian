import { registerHooks } from 'node:module';

const stub = new URL('./obsidian-stub.ts', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'obsidian') return { url: stub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

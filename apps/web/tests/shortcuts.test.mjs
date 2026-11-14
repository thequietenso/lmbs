import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../src/services/shortcuts.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { shouldFocusSearch } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('typing a slash in any form field does not steal keyboard focus', () => {
 assert.equal(shouldFocusSearch('/', false, true), false);
 assert.equal(shouldFocusSearch('/', false, false), true);
});
test('the explicit command-K shortcut works without interfering with ordinary typing', () => {
 assert.equal(shouldFocusSearch('k', true, true), true);
 assert.equal(shouldFocusSearch('k', false, true), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../src/services/bookForm.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { editableBookValues } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('editing preserves zero inventory/pages/year, custom genre and the captured version', () => {
 const book={_id:'zero',title:'A',author:'B',genre:'A custom genre',pages:0,publishedYear:0,totalCopies:0,availableCopies:0,updatedAt:'2026-11-14T00:00:00.000Z'};
 const values=editableBookValues(book);assert.equal(values.totalCopies,0);assert.equal(values.pages,0);assert.equal(values.publishedYear,0);assert.equal(values.genre,book.genre);assert.equal(values.updatedAt,book.updatedAt);assert.equal(values._id,book._id);
});

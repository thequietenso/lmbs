import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

 test('root declares all three npm workspaces', () => {
 const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
 assert.equal(pkg.private, true);
 assert.deepEqual(pkg.workspaces, ['apps/api', 'apps/web', 'packages/shared']);
 });
 test('applications are normal workspace directories, not nested repositories', () => {
 for (const app of ['api', 'web']) {
 assert.ok(existsSync(new URL(`../apps/${app}/package.json`, import.meta.url)));
 assert.equal(existsSync(new URL(`../apps/${app}/.git`, import.meta.url)), false);
 }
 });
 test('shared package exposes the frontend/backend response contract', () => {
 const pkg = JSON.parse(readFileSync(new URL('../packages/shared/package.json', import.meta.url)));
 assert.equal(pkg.name, '@lmbs/shared');
 const source = readFileSync(new URL('../packages/shared/src/index.ts', import.meta.url), 'utf8');
 for (const type of ['PaginatedResponse', 'AuthUser', 'AuthResponse']) assert.ok(source.includes(type));
 });

test('proxy deployment does not expose the trusted API or accept spoofed forwarding chains', () => {
 const compose=readFileSync(new URL('../compose.yaml',import.meta.url),'utf8');
 const api=compose.split('  api:\n')[1].split('  web:\n')[0];
 assert.match(api,/TRUST_PROXY_HOPS: ["']?1/);
 assert.doesNotMatch(api,/\n    ports:/);
 const nginx=readFileSync(new URL('../deployment/nginx.conf',import.meta.url),'utf8');
 assert.match(nginx,/proxy_set_header X-Forwarded-For \$remote_addr;/);
 assert.doesNotMatch(nginx,/proxy_add_x_forwarded_for/);
});

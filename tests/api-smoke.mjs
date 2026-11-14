// Real HTTP smoke test. Refuses non-loopback targets and requires explicit staff credentials.
import assert from 'node:assert/strict';
const base = process.env.LMBS_SMOKE_BASE_URL;
if (!base || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('Set LMBS_SMOKE_BASE_URL to an isolated loopback API, never a hosted database/service.');
}
const email = process.env.LMBS_SMOKE_ADMIN_EMAIL;
const password = process.env.LMBS_SMOKE_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Explicit LMBS_SMOKE_ADMIN_EMAIL and LMBS_SMOKE_ADMIN_PASSWORD required.');
let checks = 0;
async function call(path, { method = 'GET', token, body, key } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? {'Content-Type': 'application/json'} : {}), ...(token ? {Authorization: `Bearer ${token}`} : {}), ...(key ? {'Idempotency-Key': key} : {}) },
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  const data = await response.json();
  return { status: response.status, data };
}
function check(value, message) { assert.ok(value, message); console.log(`PASS ${++checks}: ${message}`); }
const health = await call('/health');
check(health.status === 200 && health.data.database === 'connected', 'health verifies real PostgreSQL connection');
const publicBooks = await call('/books?page=1&limit=2');
check(publicBooks.status === 200 && Array.isArray(publicBooks.data.data) && publicBooks.data.limit === 2, 'public books use paginated contract');
check((await call('/members')).status === 401, 'anonymous member access denied');
const login = await call('/auth/login', {method:'POST', body:{email,password}});
check(login.status === 201 || login.status === 200, 'explicit bootstrap staff login succeeds');
const token = login.data.access_token;
check(typeof token === 'string' && (await call('/auth/me',{token})).data.role === 'admin', 'JWT identity resolves current admin');
const nonce = crypto.randomUUID();
const patronBody = {name: 'Smoke Patron', email:`smoke-${nonce}@example.test`, password:`Smoke-only-${nonce}`};
const privileged = await call('/auth/register',{method:'POST',body:{...patronBody,role:'admin'}});
check(privileged.status === 400 || privileged.data.user?.role === 'patron', 'public registration cannot choose admin role');
const patron = await call('/auth/register',{method:'POST',body:patronBody});
check(patron.status === 201 && patron.data.user.role === 'patron', 'public signup creates only a patron');
check((await call('/members',{token:patron.data.access_token})).status === 403, 'patron cannot list private member records');
const idKey = `book-${nonce}`;
const bookBody = {title:`Smoke ${nonce}`,author:'Integration Test',genre:'Smoke Tests',totalCopies:2,pages:100,publishedYear:2020};
const created = await call('/books',{method:'POST',token,body:bookBody,key:idKey});
check(created.status === 201 && created.data.availableCopies === 2, 'staff creates book with complete inventory payload');
const bookId = created.data._id || created.data.id;
const replay = await call('/books',{method:'POST',token,body:bookBody,key:idKey});
check((replay.data._id || replay.data.id) === bookId, 'same idempotency key replays original book');
check((await call('/books',{method:'POST',token,body:{...bookBody,title:'Different'},key:idKey})).status === 409, 'idempotency key rejects changed payload');
const memberId = patron.data.user.id;
const borrowed = await Promise.all(Array.from({length:5},()=>call('/loans',{method:'POST',token,body:{bookId,memberId,days:14}})));
const successes = borrowed.filter(x=>x.status===201);
check(successes.length === 2, 'concurrent borrowing cannot exceed two physical copies');
const afterBorrow = await call(`/books/${bookId}`);
check(afterBorrow.data.availableCopies === 0, 'database inventory reaches zero without oversubscription');
const loanId = successes[0].data.id;
const returned = await Promise.all([1,2].map(()=>call(`/loans/${loanId}/return`,{method:'PUT',token,body:{}})));
check(returned.some(x=>x.status===200), 'at least one concurrent return succeeds');
check((await call(`/books/${bookId}`)).data.availableCopies === 1, 'duplicate concurrent return increments stock only once');
check((await call(`/loans/${successes[1].data.id}/renew`,{method:'PUT',token,body:{days:7}})).status === 200, 'active loan can be renewed');
const activity = await call('/activities?limit=100',{token});
check(activity.status === 200 && activity.data.data.some(a=>a.type==='borrow'), 'circulation creates database audit events');
const stats = await call('/stats/books',{token});
check(stats.status === 200 && typeof stats.data.totalBooks === 'number', 'inventory statistics query real data');
check((await call('/books/missing-smoke-book')).status === 404, 'missing book returns controlled 404');
check((await call('/books',{method:'POST',token,body:{title:'',author:'A'}})).status===400, 'invalid DTO returns 400');
console.log(`Verified ${checks} real API checks against isolated loopback service.`);

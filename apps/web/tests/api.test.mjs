import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const source = ts.transpileModule(readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const store = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k), clear:()=>values.clear() }; };
globalThis.localStorage = store(); globalThis.sessionStorage = store();
const { LibraryApiService } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const json = (body, status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});

test('reads every paginated page and preserves zero inventory and server fields',async()=>{
 const api=new LibraryApiService('http://localhost:3001/api/v1');const urls=[];
 globalThis.fetch=async url=>{urls.push(String(url));return json({data:[{_id:urls.length+'',availableCopies:0,totalCopies:0,genre:'History'}],total:2,page:urls.length,limit:1});};
 const books=await api.getBooks(); assert.equal(books.length,2);assert.equal(books[0].availableCopies,0);assert.equal(books[0].totalCopies,0);assert.match(urls[1],/page=2/);
});
test('authenticated creation sends complete editable book payload and uses authoritative response',async()=>{
 const api=new LibraryApiService();api.setSession({access_token:'test-token',user:{id:'u',email:'a@b.c',name:'Staff',role:'librarian'}});
 const data={title:'Book',author:'Author',genre:'History',pages:0,publishedYear:2001,isbn:'isbn',totalCopies:2,shelfLocation:'A',description:'Full',coverGradient:'linear-gradient(red,blue)'};
 globalThis.fetch=async (url,options)=>{assert.equal(options.headers.Authorization,'Bearer test-token');assert.deepEqual(JSON.parse(options.body),data);return json({...data,_id:'server',availableCopies:1});};
 const book=await api.createBook(data);assert.equal(book._id,'server');assert.equal(book.availableCopies,1);
});
test('book updates forward the captured version for backend stale-edit protection',async()=>{
 const api=new LibraryApiService();globalThis.fetch=async(url,options)=>{assert.deepEqual(JSON.parse(options.body),{title:'Edited',updatedAt:'2026-11-14T10:00:00.000Z'});return json({_id:'b',title:'Edited'});};await api.updateBook('b',{title:'Edited',updatedAt:'2026-11-14T10:00:00.000Z'});
});
test('API validation errors remain failures and include message arrays',async()=>{
 const api=new LibraryApiService();globalThis.fetch=async()=>json({message:['ISBN already exists','Invalid inventory']},409);
 await assert.rejects(()=>api.createBook({title:'A',author:'B',genre:'C',totalCopies:1}),/ISBN already exists.*Invalid inventory/);
});
test('changing server clears the session and never sends old bearer token',async()=>{
 const api=new LibraryApiService();api.setSession({access_token:'secret',user:{id:'u',role:'admin'}});api.setBaseUrl('https://other.example/api/v1');assert.equal(api.getSession(),null);
 globalThis.fetch=async(url,options)=>{assert.equal(options.headers.Authorization,undefined);return json({data:[],total:0,page:1,limit:100});};await api.getBooks();
});
test('401 expires the exact current session and invokes cleanup',async()=>{
 const api=new LibraryApiService();let expired=false;api.setSession({access_token:'old',user:{id:'u',role:'admin'}});api.onSessionExpired(()=>{expired=true;});
 globalThis.fetch=async()=>json({message:'Session expired'},401);await assert.rejects(()=>api.getMembers(),/Session expired/);assert.equal(api.getSession(),null);assert.equal(expired,true);
});
test('logout invalidates in-flight responses so late private data cannot be restored',async()=>{
 const api=new LibraryApiService();api.setSession({access_token:'old',user:{id:'u',role:'admin'}});let respond;
 globalThis.fetch=()=>new Promise(resolve=>{respond=resolve;});const pending=api.getMembers();api.clearSession();respond(json({data:[{id:'private'}],total:1,page:1,limit:100}));await assert.rejects(()=>pending,/Session or server changed/);
});
test('member and circulation routes use server contract with empty return payload',async()=>{
 const api=new LibraryApiService();const calls=[];globalThis.fetch=async(url,options)=>{calls.push([url,options.method,options.body && JSON.parse(options.body)]);return json({id:'result'});};
 await api.createMember({name:'P',email:'p@x.y',phone:'',membershipNumber:'M',status:'inactive'});await api.updateMember('member/1',{status:'active'});await api.deleteMember('member/1');await api.issueBook('b','m',14,'note');await api.returnBook('l');await api.renewLoan('l',7);
 assert.deepEqual(calls.map(c=>c[1]),['POST','PUT','DELETE','POST','PUT','PUT']);assert.match(calls[1][0],/member%2F1/);assert.deepEqual(calls[3][2],{bookId:'b',memberId:'m',days:14,notes:'note'});assert.deepEqual(calls[4][2],{});assert.deepEqual(calls[5][2],{days:7});
});
test('relative API URL resolves to this origin and clears an old server token',async()=>{
 globalThis.location={origin:'https://library.example'};const api=new LibraryApiService('http://localhost:3001/api/v1');api.setSession({access_token:'old',user:{id:'u',role:'admin'}});api.setBaseUrl('/api/v1');assert.equal(api.getBaseUrl(),'https://library.example/api/v1');assert.equal(api.getSession(),null);delete globalThis.location;
});
test('relative URL parser tricks cannot resolve to another origin',()=>{
 globalThis.location={origin:'https://library.example'};const api=new LibraryApiService('http://localhost:3001/api/v1');assert.throws(()=>api.setBaseUrl('/\\\\attacker.example/api/v1'),/same.origin|origin|path/i);assert.throws(()=>api.setBaseUrl('/\t/attacker.example/api/v1'),/same.origin|origin|path/i);delete globalThis.location;
});
test('invalid persisted URL does not crash startup and cannot restore its token',()=>{
 localStorage.setItem('lmbs_api_url','javascript:alert(1)');sessionStorage.setItem('lmbs_session',JSON.stringify({baseUrl:'javascript:alert(1)',access_token:'bad',user:{id:'x'}}));const api=new LibraryApiService();assert.equal(api.getBaseUrl(),'http://localhost:3001/api/v1');assert.equal(api.getSession(),null);
});
test('non-JSON unauthorized response still clears the authenticated session',async()=>{
 const api=new LibraryApiService();api.setSession({access_token:'old',user:{id:'u'}});globalThis.fetch=async()=>new Response('Unauthorized',{status:401});await assert.rejects(()=>api.getMembers());assert.equal(api.getSession(),null);
});
test('registration cannot forward a caller supplied privileged role',async()=>{
 const api=new LibraryApiService();globalThis.fetch=async(url,options)=>{assert.deepEqual(JSON.parse(options.body),{email:'p@x.y',password:'password',name:'Patron'});return json({access_token:'new',user:{id:'p',role:'patron'}});};
 await api.register({email:'p@x.y',password:'password',name:'Patron',role:'admin'});
});

test('blank optional ISBN from the book form is omitted rather than rejected by the API',async()=>{
 const api=new LibraryApiService('http://localhost:3001/api/v1');
 const payloads=[];globalThis.fetch=async(_url,opt)=>{payloads.push(JSON.parse(opt.body));return json({_id:'book',title:'Book',author:'Author',totalCopies:1,availableCopies:1});};
 await api.createBook({title:'Book',author:'Author',genre:'General',totalCopies:1,isbn:'  '});
 await api.updateBook('book',{title:'Edited',isbn:''});
 assert.equal(Object.hasOwn(payloads[0],'isbn'),false);
 assert.equal(Object.hasOwn(payloads[1],'isbn'),false);
});

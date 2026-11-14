import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const load=async path=>{const source=readFileSync(new URL(path,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);};
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),clear:()=>data.clear(),data};};
globalThis.localStorage=storage();globalThis.sessionStorage=storage();
const {LibraryApiService}=await load('../src/services/api.ts');
const {LibraryStore}=await load('../src/context/libraryStore.ts');
const demo={books:[{_id:'demo',title:'Demo',author:'A',genre:'G',totalCopies:2,availableCopies:1}],members:[{id:'demo-m',name:'Demo Patron',email:'d@x.y',status:'active'}],loans:[],activities:[]};
const staff={access_token:'staff-token',user:{id:'staff',email:'staff@x.y',name:'Librarian',role:'librarian'}};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
let remote, calls, failure;
function setup(){
 const api=new LibraryApiService('http://localhost:3001/api/v1');const cache=storage();
 const store=new LibraryStore(api,demo,cache);
 globalThis.fetch=async(url,options)=>{
  const path=new URL(url).pathname.replace('/api/v1','');calls.push([path,options.method]);
  if(path==='/auth/login'||path==='/auth/register')return response(staff);
  if(path==='/auth/me')return response(staff.user);
  if(options.method!=='GET'){if(failure)return response({message:'Server rejected'},409);return response({_id:'new',id:'new',title:'Server book',...JSON.parse(options.body||'{}'),availableCopies:1});}
  if(path.startsWith('/stats/'))return response({});
  const data=remote[path.slice(1)]||[];return response({data,total:data.length,page:1,limit:100});
 };
 return {api,store,cache};
}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();calls=[];failure=false;remote={books:[{_id:'remote',title:'Remote',genre:'History',availableCopies:0,totalCopies:2}],members:[{id:'private',name:'Private'}],loans:[],activities:[],genres:[]};});

test('health check does not change explicit demo mode or send local writes',async()=>{
 const {store}=setup();await store.checkConnection();assert.equal(store.getSnapshot().mode,'demo');await store.addBook({title:'Local',author:'A',genre:'G',totalCopies:1});assert.equal(calls.filter(c=>c[1]==='POST').length,0);
});
test('staff login replaces all demo datasets, including empty server arrays',async()=>{
 const {store}=setup();await store.login({email:'staff@x.y',password:'password'});let s=store.getSnapshot();assert.equal(s.mode,'connected');assert.deepEqual(s.books,remote.books);assert.deepEqual(s.members,remote.members);assert.deepEqual(s.loans,[]);
 remote.books=[];remote.members=[];await store.sync();s=store.getSnapshot();assert.deepEqual(s.books,[]);assert.deepEqual(s.members,[]);
});
test('connected mutation failure never modifies data or falls back to demo storage',async()=>{
 const {store,cache}=setup();await store.login({email:'staff@x.y',password:'password'});failure=true;const before=store.getSnapshot();await assert.rejects(()=>store.addBook({title:'Must fail',author:'A',genre:'G',totalCopies:1}),/Server rejected/);assert.deepEqual(store.getSnapshot().books,before.books);assert.equal([...cache.data.values()].some(v=>v.includes('Private')),false);
});
test('failed connected updates, deletes, and circulation do not mutate the visible snapshot',async()=>{
 const {store}=setup();await store.login({email:'s',password:'p'});failure=true;const before=store.getSnapshot();
 for(const action of [()=>store.updateBook('remote',{title:'No'}),()=>store.deleteBook('remote'),()=>store.addMember({name:'No'}),()=>store.updateMember('private',{name:'No'}),()=>store.deleteMember('private'),()=>store.issueBook('remote','private'),()=>store.returnBook('loan'),()=>store.renewLoan('loan')]){
  await assert.rejects(action,/Server rejected/);const state=store.getSnapshot();for(const key of ['books','members','loans','activities'])assert.deepEqual(state[key],before[key]);
 }
});
test('logout clears server identity and datasets without caching private data',async()=>{
 const {store,api,cache}=setup();await store.login({email:'s',password:'p'});store.logout();const s=store.getSnapshot();assert.equal(s.user,null);assert.equal(api.getSession(),null);assert.deepEqual(s.members,[]);assert.deepEqual(s.books,[]);assert.equal(s.mode,'connected');assert.equal([...cache.data.values()].some(v=>v.includes('Private')),false);store.enterDemo();assert.equal(store.getSnapshot().books[0]._id,'demo');
});
test('anonymous and patron connected sessions cannot mutate or read staff endpoints',async()=>{
 const {store}=setup();await store.enterConnected();assert.equal(store.getSnapshot().members.length,0);assert.equal(calls.some(c=>c[0]==='/members'),false);await assert.rejects(()=>store.deleteBook('remote'),/Staff sign-in required/);
 const oldFetch=globalThis.fetch;globalThis.fetch=(url,opt)=>new URL(url).pathname.endsWith('/auth/login')?Promise.resolve(response({...staff,user:{...staff.user,role:'patron'}})):oldFetch(url,opt);
 await store.login({email:'p',password:'p'});assert.equal(store.getSnapshot().user.role,'patron');await assert.rejects(()=>store.addMember({name:'x'}),/Staff sign-in required/);assert.equal(calls.some(c=>c[0]==='/members'),false);
});
test('staff member and circulation actions persist through correct server routes',async()=>{
 const {store}=setup();await store.login({email:'s',password:'p'});await store.addMember({name:'P',email:'p@x.y',status:'active',phone:'',membershipNumber:'N'});await store.updateMember('private',{status:'inactive'});await store.deleteMember('private');await store.issueBook('remote','private',14);await store.returnBook('loan');await store.renewLoan('loan',7);
 assert.deepEqual(calls.filter(c=>c[1]!=='GET').slice(1),[['/members','POST'],['/members/private','PUT'],['/members/private','DELETE'],['/loans','POST'],['/loans/loan/return','PUT'],['/loans/loan/renew','PUT']]);
});
test('changing URL clears private state and forbids sending old token',async()=>{
 const {store,api}=setup();await store.login({email:'s',password:'p'});store.updateApiUrl('https://new.example/api/v1');assert.equal(api.getSession(),null);assert.deepEqual(store.getSnapshot().members,[]);assert.equal(store.getSnapshot().user,null);
});
test('expired token clears private datasets and cannot accidentally enable demo edits',async()=>{
 const {store}=setup();await store.login({email:'s',password:'p'});globalThis.fetch=async()=>response({message:'Expired'},401);await assert.rejects(()=>store.sync());assert.equal(store.getSnapshot().mode,'connected');assert.equal(store.getSnapshot().user,null);assert.deepEqual(store.getSnapshot().members,[]);await assert.rejects(()=>store.deleteMember('private'),/Staff sign-in required/);
});
test('switching to demo during a pending sync discards late private responses',async()=>{
 const {store}=setup();await store.login({email:'s',password:'p'});let release;const original=globalThis.fetch;globalThis.fetch=async(url,opt)=>{if(new URL(url).pathname.endsWith('/members'))await new Promise(r=>{release=r;});return original(url,opt);};
 const pending=store.sync();store.enterDemo();release();await assert.rejects(()=>pending);assert.equal(store.getSnapshot().mode,'demo');assert.equal(store.getSnapshot().members[0].id,'demo-m');
});
test('restored session is verified once when React StrictMode starts the store twice',async()=>{
 const {api,cache}=setup();api.setSession(staff);const store=new LibraryStore(api,demo,cache);await Promise.all([store.start(),store.start()]);assert.equal(store.getSnapshot().user?.id,'staff');assert.equal(calls.filter(c=>c[0]==='/auth/me').length,1);
});
test('successful server mutation with failed refresh is not falsely reported as rejected or retried',async()=>{
 const {store}=setup();await store.login({email:'s',password:'p'});const original=globalThis.fetch;globalThis.fetch=(url,opt)=>opt.method==='GET'?Promise.resolve(response({message:'Read unavailable'},503)):original(url,opt);
 const book=await store.addBook({title:'Saved',author:'A',genre:'G',totalCopies:1});assert.equal(book._id,'new');assert.match(store.getSnapshot().error,/Saved on server/);await assert.rejects(()=>store.addBook({title:'duplicate'}),/Sync before/);
});
test('health checks and pending refresh cannot unlock a snapshot that needs reconciliation',async()=>{
 const {store}=setup();await store.login({email:'s',password:'p'});const original=globalThis.fetch;globalThis.fetch=(url,opt)=>opt.method==='GET'&&!String(url).endsWith('/health')?Promise.resolve(response({message:'Read unavailable'},503)):original(url,opt);
 await store.addBook({title:'Saved',author:'A',genre:'G',totalCopies:1});await store.checkConnection();await assert.rejects(()=>store.deleteBook('remote'),/Sync before/);
});
test('demo circulation rejects inactive patrons and repeated return cannot increase copies twice',async()=>{
 const {store}=setup();const member=await store.addMember({name:'Inactive',email:'i@x.y',phone:'',membershipNumber:'I',status:'inactive'});await assert.rejects(()=>store.issueBook('demo',member.id),/active patron/);
 const loan=await store.issueBook('demo','demo-m');await store.returnBook(loan.id);const copies=store.getSnapshot().books[0].availableCopies;await store.returnBook(loan.id);assert.equal(store.getSnapshot().books[0].availableCopies,copies);
});

test('an overlapping failed refresh cannot unlock a successful write awaiting reconciliation',async()=>{
 const {store}=setup();await store.login({email:'s',password:'p'});const original=globalThis.fetch;
 let firstStarted, releaseFirst;
 const started=new Promise(resolve=>{firstStarted=resolve;});
 let read=0;
 globalThis.fetch=async(url,opt)=>{
  if(opt.method==='GET'&&new URL(url).pathname==='/api/v1/books'){
   read++;
   if(read===1){firstStarted();await new Promise(resolve=>{releaseFirst=resolve;});}
   else return response({message:'Realtime refresh failed'},503);
  }
  return original(url,opt);
 };
 const write=store.addBook({title:'Saved remotely',author:'A',genre:'G',totalCopies:1});
 await started;
 await assert.rejects(()=>store.sync(),/Realtime refresh failed/);
 releaseFirst();await write;
 assert.equal(store.getSnapshot().needsSync,true,'successful write still requires authoritative reconciliation');
 await assert.rejects(()=>store.addBook({title:'Must not duplicate'}),/Sync before/);
});

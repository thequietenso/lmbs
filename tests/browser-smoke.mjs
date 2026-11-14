import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = process.env.LMBS_WEB_URL;
if (!origin || !['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname)) throw new Error('LMBS_WEB_URL must be an isolated loopback frontend');
const email=process.env.LMBS_SMOKE_ADMIN_EMAIL, password=process.env.LMBS_SMOKE_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Explicit test staff credentials required');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}: {})});
let checks=0;
const pass=(name)=>console.log(`PASS ${++checks}: ${name}`);
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/#/settings`);
 await page.getByLabel('Email',{exact:true}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByText('Realtime: live',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add Book',exact:true})).toBeEnabled();pass('staff login loads connected records and authenticated realtime');
 const nonce=Date.now();const title=`Browser Acceptance ${nonce}`;
 await page.getByRole('button',{name:'Add Book',exact:true}).click();
 await page.locator('#book-title-input').fill(title);await page.locator('#book-author-input').fill('Classroom Test');
 await page.locator('#book-year-input').fill('2020');await page.locator('#book-pages-input').fill('123');await page.locator('#book-copies-input').fill('2');
 await page.locator('form').filter({has:page.locator('#book-title-input')}).locator('button[type=submit]').click();
 await expect(page.locator('#book-title-input')).toBeHidden();
 await page.goto(`${origin}/#/catalog`);await expect(page.getByText(title,{exact:true})).toBeVisible();pass('book form saves real complete API record and renders server result');
 const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('lmbs_session')));
 const token=session.token || session.access_token;
 assert.ok(token,'session contains token');
 const api=session.baseUrl || session.apiUrl || 'http://localhost:3001/api/v1';
 const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
 const r=await fetch(`${api}/books?limit=100`);const data=await r.json();const book=data.data.find(x=>x.title===title);
 assert.equal(book.pages,123);assert.equal(book.totalCopies,2);pass('database-backed read confirms browser book metadata and inventory');
 await page.goto(`${origin}/#/members`);
 const buttons=await page.getByRole('button').allTextContents();
 const addName=buttons.find(n=>/Add.*(Member|Patron)|Register.*(Member|Patron)|Enroll/.test(n));
 assert.ok(addName,'member create control exists');await page.getByRole('button',{name:addName.trim(),exact:true}).click();
 await page.locator('#member-name-input').fill(`Browser Patron ${nonce}`);await page.locator('#member-email-input').fill(`browser-${nonce}@example.test`);await page.locator('#member-phone-input').fill('+15555550123');
 await page.locator('form').filter({has:page.locator('#member-name-input')}).locator('button[type=submit]').click();
 await expect(page.locator('#member-name-input')).toBeHidden();await expect(page.getByText(`Browser Patron ${nonce}`,{exact:true})).toBeVisible();pass('patron form persists through authenticated members API');
 const members=await (await fetch(`${api}/members?limit=100`,{headers})).json();const member=members.data.find(x=>x.email===`browser-${nonce}@example.test`);assert.ok(member);
 await page.getByRole('button',{name:'Issue Book',exact:true}).click();await page.locator('#issue-select-book').selectOption(book._id);await page.locator('#issue-select-member').selectOption(member.id);await page.getByRole('button',{name:'Confirm & Issue',exact:true}).click();await expect(page.locator('#issue-select-book')).toBeHidden();pass('issue modal persists loan through transactional backend');
 await page.goto(`${origin}/#/circulation`);await page.getByPlaceholder('Search loans...').fill(title);
 await expect(page.getByText(title,{exact:true})).toBeVisible();await page.getByRole('button',{name:'Renew',exact:true}).click();
 await expect(page.getByRole('button',{name:'Return',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Return',exact:true}).click();
 await expect(page.getByRole('button',{name:'Return',exact:true})).toHaveCount(0);pass('circulation browser workflow renews and returns without local-only success');
 const changed=await (await fetch(`${api}/books/${book._id}`)).json();assert.equal(changed.availableCopies,2);
 await page.goto(`${origin}/#/catalog`);
 const realtimeTitle=`Realtime Acceptance ${nonce}`;
 const cr=await fetch(`${api}/books`,{method:'POST',headers,body:JSON.stringify({title:realtimeTitle,author:'Second Client',genre:'General',totalCopies:1})});assert.equal(cr.status,201);
 await expect(page.getByText(realtimeTitle,{exact:true})).toBeVisible({timeout:10000});pass('external API mutation reaches browser through realtime invalidation and HTTP refresh');
 // Capture the already-authoritative catalog before logout clears private/server state.
 // Avoid adding another seven-request staff refresh just for screenshot capture.
 await expect(page.getByText('Clean Code',{exact:true})).toBeVisible();await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
 await page.addStyleTag({content:'*,*::before,*::after {animation:none!important;transition:none!important;caret-color:transparent!important}'});
 await page.getByLabel('Filter by genre').selectOption('Software Engineering');
 while (await page.getByRole('button',{name:'Dismiss toast',exact:true}).count()) await page.getByRole('button',{name:'Dismiss toast',exact:true}).first().click();
 await fs.mkdir('docs/images',{recursive:true});
 const captureStable=async(path)=>{
  let previous;
  for(let attempt=0;attempt<5;attempt++){
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const current=await page.screenshot({fullPage:true,animations:'disabled',caret:'hide'});
   if(previous?.equals(current)){await fs.writeFile(path,current);return;}
   previous=current;
  }
  assert.fail(`capture did not settle: ${path}`);
 };
 await captureStable('docs/images/app-preview.png');
 await page.setViewportSize({width:390,height:844});
 await captureStable('docs/images/mobile-preview.png');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile document fits viewport');pass('desktop and mobile render without horizontal overflow');
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`${origin}/#/settings`);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Add Book',exact:true})).toBeDisabled();assert.equal(await page.evaluate(()=>sessionStorage.getItem('lmbs_session')),null);pass('logout clears token and disables server management');
 assert.deepEqual(errors,[]);pass('no browser runtime exceptions');
 console.log(`Verified ${checks} authenticated real-browser checks; screenshots in docs/images.`);
} finally {await browser.close();}

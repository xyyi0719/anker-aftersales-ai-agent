import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>console.log('Failed request',r.url(),r.failure()?.errorText));
const requests=[];
await page.setRequestInterception(true);
page.on('request',async r=>{
 if(r.url().includes('/dify-api/chat-messages')){
  const body=JSON.parse(r.postData());requests.push(body);
  const state={schema_version:1,mock:true,product:'Anker737',node:'cable',tasks:[{kind:'troubleshooting',status:'waiting_user'}],history:[{from_node:'start',to_node:'cable',response:'自己'}],citations:[{chunk_id:'faq_anker737_f1',text:'检查墙插、线与充电头。',metadata:{source:'FAQ 快照',source_url:'https://service.anker.com'}}]};
  return r.respond({status:200,contentType:'application/json',body:JSON.stringify({answer:'请确认是否已换过线和充电头。\n__EVIDENCE_V1__'+Buffer.from(JSON.stringify(state)).toString('base64')+'__EVIDENCE_END__',conversation_id:'test-conversation'})});
 }
 if(r.url().includes('/dify-api/files/upload'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({id:'test-upload'})});
 return r.continue();
});
try {
 await page.setViewport({width:1440,height:1000});await page.goto('http://127.0.0.1:4173');
 await page.waitForSelector('textarea');
 fs.mkdirSync('../docs/screenshots',{recursive:true});
 await page.screenshot({path:'../docs/screenshots/desktop-empty.png',fullPage:true});
 await page.type('textarea','Anker 737 充不进电');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.innerText.includes('已收到服务回复'));
 assert.equal(requests.length,1);assert.equal(requests[0].response_mode,'blocking');
 assert(!await page.evaluate(()=>document.body.innerText.includes('__EVIDENCE_V1__')));
 await page.click('.conversation-heading button');await page.waitForSelector('.citation');
 assert(await page.evaluate(()=>document.body.innerText.includes('等待补充')));
 await page.screenshot({path:'../docs/screenshots/desktop-evidence.png',fullPage:true});
 await page.setViewport({width:375,height:812});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:'../docs/screenshots/mobile-evidence.png',fullPage:true});
 await page.click('.button.quiet');await page.type('textarea','输入法测试');
 await page.$eval('textarea',el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true})));
 assert.equal(requests.length,1);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Browser checks passed: desktop/mobile, no overflow, request, evidence, reset, IME, no JS errors.');
} catch(e) {console.log('Page errors:',errors);console.log('Visible:',await page.evaluate(()=>document.body.innerText));throw e;} finally {await browser.close();}

import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox']
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => console.log('Failed request', r.url(), r.failure()?.errorText));

const requests = [];
let respondState = {
  schema_version: 1,
  mock: true,
  product: 'Anker737',
  node: 'cable',
  tasks: [{ kind: 'troubleshooting', status: 'waiting_user' }],
  history: [{ from_node: 'start', to_node: 'cable', response: '自己' }],
  citations: [{ chunk_id: 'faq_anker737_f1', text: '检查墙插、线与充电头。', metadata: { source: 'FAQ 快照', source_url: 'https://service.anker.com' } }]
};
await page.setRequestInterception(true);
page.on('request', async r => {
  if (r.url().includes('/dify-api/chat-messages')) {
    const body = JSON.parse(r.postData());
    requests.push(body);
    return r.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: '请确认是否已换过线和充电头。\n__EVIDENCE_V1__' + Buffer.from(JSON.stringify(respondState)).toString('base64') + '__EVIDENCE_END__',
        conversation_id: 'test-conversation',
        metadata: { retriever_resources: [{ document_name: 'FAQ 快照', content: '检查墙插、线与充电头。', score: 0.95 }] }
      })
    });
  }
  if (r.url().includes('/dify-api/files/upload')) {
    return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-upload' }) });
  }
  return r.continue();
});

try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4173');
  await page.waitForSelector('textarea');

  fs.mkdirSync('../docs/screenshots', { recursive: true });
  await page.screenshot({ path: '../docs/screenshots/desktop-empty.png', fullPage: true });

  await page.type('textarea', 'Anker 737 充不进电');
  await page.keyboard.press('Enter');

  await page.waitForFunction(() => document.body.innerText.includes('已收到服务回复') || document.body.innerText.includes('服务在线'));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].response_mode, 'blocking');
  assert(!await page.evaluate(() => document.body.innerText.includes('__EVIDENCE_V1__')));

  // 验证防线与审计看板结构
  assert(await page.evaluate(() => document.body.innerText.includes('第一道 · 流程锁')));
  assert(await page.evaluate(() => document.body.innerText.includes('第二道 · 出处锁')));

  await page.screenshot({ path: '../docs/screenshots/desktop-evidence.png', fullPage: true });

  // 移动端无溢出检验
  await page.setViewport({ width: 375, height: 812 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: '../docs/screenshots/mobile-evidence.png', fullPage: true });

  // 恢复桌面端并测试重置与输入法合成事件
  await page.setViewport({ width: 1440, height: 1000 });
  const resetBtn = await page.$('.action-btn.text-danger');
  if (resetBtn) await resetBtn.click();

  await page.type('textarea', '输入法测试');
  await page.$eval('textarea', el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })));
  assert.equal(requests.length, 1);
  assert.equal(errors.length, 0, errors.join('\n'));

  // ===== 契约 C：审计看板只能显示 evidence 里的真实视觉数据 =====
  const panelText = async () => {
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll('.side-tab-btn')].find(b => b.innerText.includes('看图'));
      if (tab) tab.click();
    });
    await new Promise(r => setTimeout(r, 150));
    return page.evaluate(() => document.body.innerText);
  };
  const ask = async (text, vision) => {
    const before = requests.length;
    respondState = { schema_version: 1, mock: true, product: 'Anker737', node: 'start',
                     tasks: [{ kind: 'troubleshooting', status: 'waiting_user' }], vision };
    await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('textarea', text);
    await page.keyboard.press('Enter');
    for (let i = 0; i < 60 && requests.length === before; i++) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 500));
  };

  // 无视觉数据：不得编造型号或置信度（无图时展示空状态引导）
  await ask('Anker 737 充不进电', undefined);
  let text = await panelText();
  assert(!text.includes('88%'), '无视觉数据时出现被写死的置信度 88%');
  assert(text.includes('用户上传故障图后'), '无视觉数据时未显示空状态引导');

  // 安全类现象：不受置信度门槛限制
  await ask('帮我看看', { product_model: 'unknown', fault_location: '电芯', fault_phenomenon: '鼓包', confidence: 0.3, is_anker_product: true, brand: 'unknown' });
  text = await panelText();
  assert(text.includes('鼓包'), '故障现象未显示中文枚举值');
  assert(text.includes('安全高危故障'), '低置信度的安全现象未触发安全横幅');

  // 屏幕异常：唯一会真正跳过现象提问的现象
  await ask('帮我看看', { product_model: 'Anker737', fault_location: '屏幕', fault_phenomenon: '屏幕异常', confidence: 0.9, is_anker_product: true, brand: 'Anker' });
  text = await panelText();
  assert(text.includes('排障树已跳级'), '屏幕异常未显示跳级横幅');

  // 线材破损：不跳级，不得宣称已跳级
  await ask('帮我看看', { product_model: 'unknown', fault_location: '线材', fault_phenomenon: '线材破损', confidence: 0.9, is_anker_product: true, brand: 'unknown' });
  text = await panelText();
  assert(text.includes('线材破损'), '线材破损未显示');
  assert(!text.includes('排障树已跳级'), '线材破损错误宣称已跳级');

  // 非 Anker：拒答横幅 + 品牌依据
  await ask('帮我看看', { product_model: 'unknown', fault_location: '机身', fault_phenomenon: 'unknown', confidence: 0.9, is_anker_product: false, brand: 'baseus' });
  text = await panelText();
  assert(text.includes('非 Anker 生态产品'), '非 Anker 未显示拒答横幅');
  assert(text.includes('baseus'), '未显示图上品牌依据');

  assert.equal(errors.length, 0, errors.join('\n'));

  console.log('Browser checks passed: desktop/mobile, no overflow, request, evidence, reset, IME, contract-C vision, no JS errors.');
} catch (e) {
  console.log('Page errors:', errors);
  console.log('Visible:', await page.evaluate(() => document.body.innerText));
  throw e;
} finally {
  await browser.close();
}

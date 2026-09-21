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
const actionRequests = [];
let actionFail = false;
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
  if (r.url().includes('/mock-api/api/chat/action')) {
    actionRequests.push(JSON.parse(r.postData()));
    if (actionFail) {
      return r.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'boom' }) });
    }
    return r.respond({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, ticket: { ticket_id: 'MOCK-TEST', status: 'transfer_requested', dispatched: false }, message: '已提交转派申请' })
    });
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
  // 三层看板一次性展示，无需切 tab
  const panelText = async () => page.evaluate(() => document.body.innerText);
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
  assert(text.includes('上传故障照片后'), '无视觉数据时未显示空状态引导');

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

  // ===== B1：右侧三层看板 =====
  respondState = {
    schema_version: 1, mock: true,
    summary: '在排查 737 充不进电，已确认换线无效，卡在屏幕反应确认',
    product: '', node: 'cable',
    tasks: [{ kind: 'troubleshooting', status: 'waiting_user' }, { kind: 'safety', status: 'escalated' }],
    citations: [{ chunk_id: 'faq_anker737_f1', text: '检查墙插、线与充电头。', metadata: { source: 'FAQ 快照', source_url: 'https://service.anker.com' } }],
  };
  const beforeB1 = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '帮我看下充电情况');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeB1; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 500));

  assert(await page.$('.layer-summary'), '缺少上层容器');
  assert(await page.$('.layer-profile'), '缺少中层容器');
  assert(await page.$('.layer-ticket'), '缺少下层容器');

  const b1Text = await page.evaluate(() => document.body.innerText);
  assert(b1Text.includes('已确认换线无效'), '会话摘要未渲染');
  for (const oldTab of ['决策与路由', '看图跳级', '情绪监测', '出处检索']) {
    assert(!b1Text.includes(oldTab), `旧 tab 未移除：${oldTab}`);
  }
  assert(b1Text.includes('待提取'), '缺视觉数据时未显示「待提取」');
  assert(b1Text.includes('faq_anker737_f1'), '处理依据未渲染');
  assert(b1Text.includes('当前无工单'), '无工单时未显示「当前无工单」');

  const tagColors = await page.evaluate(() =>
    [...document.querySelectorAll('.demand-tag')].map(el => ({ kind: el.getAttribute('data-kind'), color: getComputedStyle(el).color }))
  );
  const byKind = Object.fromEntries(tagColors.map(t => [t.kind, t.color]));
  assert(byKind.safety && byKind.troubleshooting, '诉求标签未渲染');
  assert(byKind.safety !== byKind.troubleshooting, 'safety 与 troubleshooting 标签颜色相同');

  // ===== B2：用户气泡情绪/理解辅助（只挂用户消息）=====
  respondState = {
    schema_version: 1, mock: true,
    product: 'Anker737', emotion: 'L2', node: 'start',
    intents: ['troubleshooting'],
    tasks: [{ kind: 'troubleshooting', status: 'waiting_user' }],
  };
  const beforeB2 = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '快气死我了，我的737充不进电');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeB2; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 500));

  const ubText = await page.evaluate(() => {
    const b = document.querySelector('.understanding-bubble');
    return b ? b.innerText : '';
  });
  assert(ubText.includes('明显愤怒'), '用户气泡未按 L2 显示「明显愤怒」');
  assert(/理解为：\s*故障报修\s*·\s*Anker\s*737\s*·\s*充不进电/.test(ubText), '理解为三要素未同行以 · 分隔');
  assert(await page.evaluate(() => document.querySelectorAll('.message-bubble-row.ai-side .understanding-bubble').length === 0),
    'AI 气泡下方出现了辅助气泡');
  assert(await page.evaluate(() => document.querySelectorAll('.understanding-bubble').length === 1),
    '辅助气泡应只挂在最后一条用户消息下');

  // L0 且无其它信息：不得出现 unknown
  respondState = { schema_version: 1, mock: true, product: '', emotion: 'L0', tasks: [] };
  const beforeB2b = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '你好');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeB2b; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 400));
  const ubText2 = await page.evaluate(() => document.querySelector('.understanding-bubble')?.innerText || '');
  assert(!/unknown/i.test(ubText2), '未识别项出现了 unknown 字样');

  // ===== B2：可点选项芯片 =====
  const waitIdle = async () => {
    for (let i = 0; i < 40; i++) {
      if (!(await page.evaluate(() => !!document.querySelector('.option-chip:disabled')))) return;
      await new Promise(r => setTimeout(r, 50));
    }
  };
  respondState = {
    schema_version: 1, mock: true,
    product: 'Anker737', node: 'start',
    options: [
      { label: '充电宝自己充不进', value: '自己' },
      { label: '给手机充电不行', value: '输出' },
    ],
    tasks: [{ kind: 'troubleshooting', status: 'waiting_user' }],
  };
  const beforeChips = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', 'Anker 737 充不进电');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeChips; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 600));

  const chipCount = await page.evaluate(() => document.querySelectorAll('.option-chip').length);
  assert(chipCount === 2, `选项芯片数量应为 2，实际 ${chipCount}`);

  await waitIdle();
  const beforeClick = requests.length;
  await page.click('.option-chip');
  for (let i = 0; i < 60 && requests.length === beforeClick; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 300));
  assert(requests.length === beforeClick + 1, '点击芯片未发出聊天请求');
  assert(requests[requests.length - 1].query === '自己',
    `点击芯片应发送 value，实际 ${requests[requests.length - 1].query}`);

  // 上限：注入 4 项只渲染 3 个
  respondState = {
    schema_version: 1, mock: true, product: 'Anker737', node: 'start',
    options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }, { label: 'C', value: 'c' }, { label: 'D', value: 'd' }],
    tasks: [{ kind: 'troubleshooting', status: 'waiting_user' }],
  };
  const beforeCap = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '再来一次');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeCap; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 600));
  const capCount = await page.evaluate(() => document.querySelectorAll('.option-chip').length);
  assert(capCount === 3, `选项上限应为 3，实际 ${capCount}`);

  // 脚本注入防御：label 里的标签被转义，不生成元素、不执行
  respondState = {
    schema_version: 1, mock: true, product: 'Anker737', node: 'start',
    options: [{ label: '<img src=x onerror="window.__xss=1">', value: '自己' }], tasks: [],
  };
  const beforeXss = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '注入检查');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeXss; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 500));
  assert(await page.evaluate(() => document.querySelectorAll('.option-chip img').length === 0), '芯片内渲染出了注入的标签');
  assert(!(await page.evaluate(() => window.__xss === 1)), '芯片文本未转义，注入脚本被执行');

  // 空选项：不渲染容器
  respondState = { schema_version: 1, mock: true, product: 'Anker737', node: 'start', options: [], tasks: [] };
  const beforeEmpty = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '空选项检查');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeEmpty; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 500));
  assert(await page.evaluate(() => document.querySelector('.option-chips') === null), '空选项仍渲染了容器');

  // ===== B3：工单流程与转派 =====
  const stepDone = label => page.evaluate(l => {
    const li = [...document.querySelectorAll('.ticket-step')].find(el => el.innerText.includes(l));
    return li ? li.classList.contains('done') : null;
  }, label);

  respondState = {
    schema_version: 1, mock: true, product: 'Anker737', node: 'cable',
    ticket: { ticket_id: 'MOCK-TEST', status: 'mock_pending', dispatched: false },
    tasks: [{ kind: 'handoff', status: 'mock_pending' }],
  };
  const beforeB3 = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '帮我建个工单');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeB3; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 600));

  assert(!(await page.evaluate(() => document.body.innerText)).includes('当前无工单'), '有工单时仍显示「当前无工单」');
  assert((await stepDone('已定位故障')) === true, '已定位故障未点亮');
  assert((await stepDone('已生成工单')) === true, '已生成工单未点亮');
  assert((await stepDone('已提交转派申请')) === false, '未转派却点亮了已提交转派申请');
  assert(await page.$('.ticket-action-btn'), '有工单且未转派时未出现「确认转派」按钮');

  const beforeClickReq = requests.length;
  const beforeAction = actionRequests.length;
  await page.click('.ticket-action-btn');
  for (let i = 0; i < 60 && actionRequests.length === beforeAction; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 400));
  assert(actionRequests.length === beforeAction + 1, '点击未调用动作接口');
  assert(actionRequests[actionRequests.length - 1].action === 'transfer_to_agent', 'action 参数不正确');
  assert(actionRequests[actionRequests.length - 1].ticket_id === 'MOCK-TEST', 'ticket_id 参数不正确');
  assert(requests.length === beforeClickReq, '点转派不应产生 /dify-api/chat-messages 请求');
  assert((await stepDone('已提交转派申请')) === true, '成功转派后节点未推进');
  assert(!(await page.$('.ticket-action-btn')), '成功转派后按钮未消失');

  const b3Text = await page.evaluate(() => document.body.innerText);
  assert(!b3Text.includes('已转派'), '出现禁止措辞「已转派」');
  assert(!b3Text.includes('专员已接单'), '出现禁止措辞「专员已接单」');
  assert(!/\d+\s*分钟/.test(b3Text), '出现时长承诺');

  // 失败不假装：接口 500 时不得显示已提交转派申请，且给出重试提示
  actionFail = true;
  respondState = {
    schema_version: 1, mock: true, product: 'Anker737', node: 'cable',
    ticket: { ticket_id: 'MOCK-FAIL', status: 'mock_pending', dispatched: false },
    tasks: [{ kind: 'handoff', status: 'mock_pending' }],
  };
  const beforeFail = requests.length;
  await page.$eval('textarea', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('textarea', '再来一个工单');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 60 && requests.length === beforeFail; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 600));

  const beforeFailClick = actionRequests.length;
  await page.click('.ticket-action-btn');
  for (let i = 0; i < 60 && actionRequests.length === beforeFailClick; i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 400));
  assert((await stepDone('已提交转派申请')) === false, '接口失败却显示已提交转派申请');
  assert(await page.$('.ticket-action-btn'), '失败后按钮未恢复可点');
  assert((await page.evaluate(() => document.body.innerText)).includes('提交失败，请重试'), '失败未给出重试提示');
  actionFail = false;

  // ===== B4：解释性文案清理与状态词 =====
  const cleanedText = await page.evaluate(() => document.body.innerText);
  for (const banned of [
    '新航无Bug', 'L3 审计在线', '四道防线全时锁闭', '有限状态机决策',
    '条款按边界切片', '门限 ≥ 0.8', '未知即一等公民', '只挂载合规API',
    '退款/补偿权限隔离', 'L3 可解释性决策与安全审计看板', '合规审计视界',
    '看图办事 · 结构化四元组提取', '出处锁机制',
    '置信度达标 · 锁定条款出处安全作答', '置信度不足门限', '出处锁 · 引用了',
    '诱导提问·诚实升级', '暴怒投诉·情绪升级', '🛡️', '🔀', '📦', '😡',
  ]) {
    assert(!cleanedText.includes(banned), `残留解释性文案：${banned}`);
  }
  assert(/第 \d 道已触发|全部正常/.test(cleanedText), '防线汇总未显示状态词');

  // 权限锁：提出退款诉求后点亮
  await ask('你直接给我退款', undefined);
  assert((await page.evaluate(() => document.body.innerText)).includes('已阻断越权请求'), '退款诉求未点亮权限锁');

  assert.equal(errors.length, 0, errors.join('\n'));

  console.log('Browser checks passed: desktop/mobile, no overflow, request, evidence, reset, IME, contract-C vision, no JS errors.');
} catch (e) {
  console.log('Page errors:', errors);
  console.log('Visible:', await page.evaluate(() => document.body.innerText));
  throw e;
} finally {
  await browser.close();
}

import type { ChatMessage } from '../types';

// btoa 只接受 Latin-1，中文会抛 InvalidCharacterError；这里按 UTF-8 编码后再转 base64。
// 前端 evidence.ts 用 atob + TextDecoder('utf-8') 解码，两端一致。
function b64utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

export function getMockSopResponse(query: string, files: Array<{ type: string; url: string }> = []): {
  answer: string;
  retrieverResources?: ChatMessage['retrieverResources'];
} {
  const q = query.toLowerCase();
  const hasImage = files.length > 0;

  // 1. 诱导提问 / 召回 / 爆炸 (第三道：置信度锁诚实升级)
  if (q.includes('召回') || q.includes('爆炸') || q.includes('自燃')) {
    return {
      answer:
        '关于产品召回，我们手头没有可核验的最新依据，不能替您下结论。已转专员为您核实，请以专员的答复为准。',
      retrieverResources: [],
    };
  }

  // 2. S1 Pro 产品消歧 (功能点三：问清与消歧)
  if (q.includes('s1 pro') || q.includes('s1pro')) {
    const disambigEvidence = {
      schema_version: 1,
      mock: true,
      // 消歧追问也走「快速模拟对话」小气泡：气泡内容就是用户要回的那几个字
      options: [
        { label: '扫地机器人', value: '扫地机器人' },
        { label: '吸奶器', value: '吸奶器' },
      ],
    };
    return {
      answer:
        '收到您的反馈。由于 "S1 Pro" 属于多品类共用型号，请确认您正在排查的具体设备：请回复「扫地机器人」或「吸奶器」。\n' +
        `__EVIDENCE_V1__${b64utf8(JSON.stringify(disambigEvidence))}__EVIDENCE_END__`,
      retrieverResources: [
        {
          document_name: 'Anker/eufy 品类命名索引',
          content: 'S1 Pro 在 eufy 旗下存在吸奶器与扫地机器人两个独立产品线，排障 SOP 互不通用。',
          score: 0.95,
          segment_id: 'product_disambig_s1',
        },
      ],
    };
  }

  // 3. 安全类问题：鼓包 / 烧灼（图片安全拦截）
  if (q.includes('鼓包') || q.includes('烧焦') || q.includes('烧灼') || q.includes('开裂') || (hasImage && files[0]?.url?.includes('03_') || files[0]?.url?.includes('04_') || files[0]?.url?.includes('05_'))) {
    return {
      answer:
        '识别到设备可能存在电芯形变或接口烧蚀的风险。为了用电安全，请立即断开电源并停止使用，切勿挤压或拆解设备。我们已升级专员工单为您优先处理。',
      retrieverResources: [
        {
          document_name: 'Anker 锂电池安全处理红线规范',
          content: '若移动电源发生外壳鼓包、严重形变或炭化异味，禁止执行普通排障，必须立即升级 P0 换新并提示用户停止使用。',
          score: 0.98,
          segment_id: 'safety_sop_01',
        },
      ],
    };
  }

  // 4. 暴怒 / 投诉 (接稳 · 情绪三级机制与安抚工单)
  if (q.includes('投诉') || q.includes('垃圾') || q.includes('气死') || q.includes('赔偿') || q.includes('维权')) {
    return {
      answer:
        '非常抱歉给您带来这么差的体验，我理解您的焦急。我们不会推诿，已经把前面排查过的记录整理好交给主管专员，由他直接承接您的诉求。',
      retrieverResources: [
        {
          document_name: 'Anker 售后情绪三级响应 SOP',
          content: '当检测到投诉风险或连续暴怒时，触发强共情话术，自动汇总已诊断证据并移交主管专员。',
          score: 0.92,
          segment_id: 'empathy_sop_l3',
        },
      ],
    };
  }

  // 5. 竞品设备 (边界拒答)
  if (q.includes('倍思') || q.includes('baseus') || (hasImage && (files[0]?.url?.includes('11_') || files[0]?.url?.includes('12_')))) {
    return {
      answer:
        '这张图看起来不是 Anker / Soundcore / eufy 的产品。我们目前只服务安克官方授权产品的售后排障与质保，建议您联系原购买渠道或对应品牌的客服，他们会更专业。感谢理解。',
      retrieverResources: [],
    };
  }

  // 5.5 排障推进（离线演示专用）：让「快速模拟对话」的气泡能真正往前走。
  //     无状态兜底若不区分上一问的回答，会把同一个问题反复抛出，看起来像「卡住」。
  const MOCK_STEPS: Record<string, { answer: string; node: string; status: string; options?: Array<{ label: string; value: string }> }> = {
    '仍不行': {
      answer: '好的，换过线材和充电头后仍然充不进电。最后确认一步：充电时屏幕有反应吗？',
      node: 'display',
      status: 'waiting_user',
      options: [
        { label: '屏幕黑屏', value: '黑屏' },
        { label: '屏幕有显示', value: '有显示' },
        { label: '屏幕显示 UVP', value: 'UVP' },
      ],
    },
    '黑屏': {
      answer: '交叉排查后仍无法充电，属于硬件问题，需要售后核实；我们不会在缺少依据时承诺换新。',
      node: 'hardware',
      status: 'needs_review',
    },
    '有显示': {
      answer: '屏幕有显示说明协议已握手但功率偏低。建议换用 100W 以上 PD 3.1 线材后复测；仍然不行请联系售后核实。',
      node: 'slow',
      status: 'resolved',
    },
    'UVP': {
      answer: 'UVP 是欠压保护提示。建议更换线材与充电头后复测；若仍然出现，请交给售后核实硬件。',
      node: 'uvp',
      status: 'needs_review',
    },
    '恢复了': {
      answer: '好的，问题已经恢复。如果再次出现，随时联系我们。',
      node: 'resolved',
      status: 'resolved',
    },
  };
  const step = MOCK_STEPS[query.replace(/[\s。.!！?？]/g, '')];
  if (step) {
    const stepEvidence: Record<string, unknown> = {
      schema_version: 1,
      mock: true,
      product: 'Anker737',
      node: step.node,
      tasks: [{ kind: 'troubleshooting', status: step.status }],
    };
    if (step.options) stepEvidence.options = step.options;
    return {
      answer: step.answer + `\n__EVIDENCE_V1__${b64utf8(JSON.stringify(stepEvidence))}__EVIDENCE_END__`,
      retrieverResources: [],
    };
  }

  // 6. 默认排障与政策问答 (有限状态排障与出处锁)
  const evidenceState = {
    schema_version: 1,
    mock: true,
    product: q.includes('耳机') || q.includes('soundcore') ? 'Soundcore' : 'Anker 737',
    node: 'cable',
    tasks: [{ kind: 'troubleshooting', status: 'waiting_user' }, { kind: 'warranty', status: 'checked' }],
    // 离线兜底也带本轮追问选项，供本地/断网演示「快速模拟对话」
    options: [
      { label: '换了也不行', value: '仍不行' },
      { label: '换完就好了', value: '恢复了' },
    ],
    citations: [
      {
        chunk_id: 'faq_anker737_f1',
        text: '检查墙插、线材与充电头，建议使用 100W 以上 PD 3.1 专用线材进行交叉验证。',
        metadata: { source: '官方知识库快照', source_url: 'https://service.anker.com' },
      },
    ],
  };

  const b64Evidence = b64utf8(JSON.stringify(evidenceState));

  return {
    answer:
      `收到您的反馈。对于 ${q.includes('耳机') ? 'Soundcore 耳机' : 'Anker 737 移动电源'}，请您先确认：是否已更换过其它线材和充电器进行排查？指示灯或显示屏是否有具体输出功率？\n__EVIDENCE_V1__${b64Evidence}__EVIDENCE_END__`,
    retrieverResources: [
      {
        document_name: 'Anker 737 官方排障指南 V2',
        content: '移动电源无法充电时，首先应排除外接线材损耗，推荐使用原装 C-C 高功率编织线并长按电量键重置协议芯片。',
        score: 0.91,
        segment_id: 'faq_anker737_f1',
      },
      {
        document_name: 'Anker 全球质保服务承诺',
        content: '官方渠道购买的正品移动电源享有 18~24 个月有限硬件质保，非人为损坏提供免费换新服务。',
        score: 0.86,
        segment_id: 'policy_warranty_us',
      },
    ],
  };
}

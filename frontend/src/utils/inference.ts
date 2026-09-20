/**
 * 纯前端意图/情绪/产品推断工具
 * 从用户 query 实时推断各种状态，让右侧面板在 LLM 返回前就能显示状态
 * 当 Dify 返回结构化状态时（如果有），会被 LLM 输出覆盖
 */

import type { EmotionPoint, RoutingStep, TaskItem } from '../types';

// ========== 关键词词典 ==========

const COMPLAINT_KW = ['315', '工商', '起诉', '曝光', '律师', '维权', '打官司', '投诉', '差评', '黑猫', '12315', '消协'];
const TRANSFER_KW = ['经理', '人工', '主管', '找老板', '找人', '真人', '领导'];
const RETURN_KW = ['退货', '换货', '退款', '不要了', '退掉', '退一', '换新', '7天无理由'];
const TROUBLE_KW = [
  '不吸', '鼓包', '漏液', '起火', '冒烟', '充不进', '坏了', '用不了', '不动', '不工作',
  '故障', '死机', '掉电', '接触不良', '异响', '发热', '发烫', '不亮', '不响', '不转',
  '无法开机', '开不了机', '充电慢', '发热严重', '无法充电', '没反应', '不识别',
];
const INQUIRY_KW = [
  '怎么', '多久', '什么时候', '能否', '可以', '保修', '教程', '兼容', '支持', '什么是',
  '区别', '怎样', '如何', '配置', '说明', '说明书', '能不能', '在哪里', '在哪',
];

const ANGRY_KW = ['气死', '太过分', '忍无可忍', '气炸', '怒', '投诉', '无良', '骗子', '垃圾', '受不了', '救命', '爆炸', '自燃', '烧了', '烫伤', '焦味', '愤怒'];
const UPSET_KW = ['失望', '不应该', '烦', '郁闷', '糟心', '恼火', '不好', '很急', '着急', '急死', '快急', '紧急', '帮忙', '怎么办', '无助', '崩溃', '崩溃', '焦虑', '烦躁', '不满意', '糟糕', '坏', '故障', '罢工', '坏了', '坏了', '不工作', '不动了', '没反应', '无响应', '求救', '救命', '故障'];
const COMPLAINT_EMO_KW = [...COMPLAINT_KW, '维权', '曝光'];

// ========== 产品型号正则 ==========

interface ProductPattern {
  pattern: RegExp;
  category: string;
  ambiguous?: boolean;
  candidates?: string[];
}

const PRODUCT_MODEL_PATTERNS: ProductPattern[] = [
  { pattern: /737|prime\s*737/i, category: '充电宝' },
  { pattern: /PowerCore/i, category: '充电宝' },
  { pattern: /S1\s*Pro/i, category: '歧义', ambiguous: true, candidates: ['eufy 吸奶器 S1 Pro', 'eufy RoboVac 扫地机 S1 Pro'] },
  { pattern: /Soundcore\s*(Work\s*)?3200/i, category: 'Soundcore' },
  { pattern: /Soundcore/i, category: 'Soundcore' },
  { pattern: /Liberty\s*\d/i, category: 'Soundcore 耳机' },
  { pattern: /Life\s*[A-Z]?\d/i, category: 'Soundcore 音箱' },
  { pattern: /RoboVac/i, category: 'eufy 扫地机' },
  { pattern: /eufy\s*Cam/i, category: 'eufy 摄像头' },
  { pattern: /eufy/i, category: 'eufy' },
  { pattern: /Anker/i, category: 'Anker' },
];

// 歧义信号词（出现 + S1 Pro 型号才标记歧义）
const AMBIGUITY_KW = ['不吸', '吸不住', '不能吸', '吸力', '吸不出'];

// ========== 推断函数 ==========

export function inferIntent(query: string): { id: string; label: string; confidence: number } {
  const q = query;
  // 优先级: complaint > transfer > return > troubleshooting > inquiry > out_of_scope
  if (COMPLAINT_KW.some(k => q.includes(k))) return { id: 'complaint', label: '投诉', confidence: 0.9 };
  if (TRANSFER_KW.some(k => q.includes(k))) return { id: 'transfer_human', label: '转人工', confidence: 0.85 };
  if (RETURN_KW.some(k => q.includes(k))) return { id: 'return_or_exchange', label: '退换', confidence: 0.85 };
  if (TROUBLE_KW.some(k => q.includes(k))) return { id: 'troubleshooting', label: '故障报修', confidence: 0.85 };
  if (INQUIRY_KW.some(k => q.includes(k))) return { id: 'inquiry', label: '咨询', confidence: 0.7 };
  return { id: 'out_of_scope', label: '兜底', confidence: 0.5 };
}

export function inferEmotion(query: string): { level: 'normal' | 'upset' | 'angry' | 'complaint'; trigger?: string } {
  // V4.2 P1: 情绪强度组合规则
  // 「很急」+「完全不工作」类组合 = angry（明确受挫）
  // 单独「很急」/「不工作」= upset
  const urgentKw = ['很急', '急死', '快急', '紧急', '着急'];
  const brokenKw = ['完全不工作', '彻底不工作', '罢工', '死机', '崩溃', '不工作了', '不响应', '没反应', '坏了', '不能用了', '用不了', '不工作'];
  const hasUrgent = urgentKw.some(k => query.includes(k));
  const hasBroken = brokenKw.some(k => query.includes(k));
  if (hasUrgent && hasBroken) return { level: 'angry', trigger: urgentKw.find(k => query.includes(k)) + '+' + brokenKw.find(k => query.includes(k)) };

  if (COMPLAINT_EMO_KW.some(k => query.includes(k))) return { level: 'complaint', trigger: query.match(new RegExp(COMPLAINT_EMO_KW.filter(k => query.includes(k)).join('|')))![0] };
  if (ANGRY_KW.some(k => query.includes(k))) return { level: 'angry', trigger: query.match(new RegExp(ANGRY_KW.filter(k => query.includes(k)).join('|')))![0] };
  if (UPSET_KW.some(k => query.includes(k))) return { level: 'upset', trigger: query.match(new RegExp(UPSET_KW.filter(k => query.includes(k)).join('|')))![0] };
  return { level: 'normal' };
}

export function inferProductModel(query: string): { model: string; category: string; ambiguous?: boolean; candidates?: string[] } | undefined {
  for (const { pattern, category, ambiguous, candidates } of PRODUCT_MODEL_PATTERNS) {
    const m = query.match(pattern);
    if (m) {
      // S1 Pro 型号在 eufy 旗下多产品共用 → 永远歧义
      if (ambiguous) {
        return { model: m[0], category, ambiguous: true, candidates };
      }
      // 其它型号 + 歧义信号词 → 标记歧义
      if (AMBIGUITY_KW.some(k => query.includes(k))) {
        return { model: m[0], category, ambiguous: true, candidates: [category + '多型号'] };
      }
      return { model: m[0], category, ambiguous, candidates };
    }
  }
  return undefined;
}

// 推断是否歧义
export function inferAmbiguous(product: ReturnType<typeof inferProductModel>): boolean {
  return !!product?.ambiguous;
}

export function inferAction(intentId: string, emotion: ReturnType<typeof inferEmotion>['level']): { id: string; label: string } {
  if (emotion === 'angry' || emotion === 'complaint') return { id: 'escalation', label: '升级处理' };
  if (intentId === 'troubleshooting') return { id: 'troubleshoot', label: '排障引导' };
  if (intentId === 'return_or_exchange') return { id: 'return', label: '退货流程' };
  if (intentId === 'transfer_human') return { id: 'transfer', label: '转人工' };
  if (intentId === 'inquiry') return { id: 'policy_retrieve', label: '政策检索' };
  if (intentId === 'complaint') return { id: 'complaint', label: '投诉处理' };
  return { id: 'fallback', label: '兜底回复' };
}

// ========== 检测危险关键词（鼓包/漏液/起火）==========

const SAFETY_KW = ['鼓包', '漏液', '起火', '冒烟', '异味', '烫手', '爆炸'];
export function inferSafety(query: string): { unsafe: boolean; keyword?: string } {
  for (const k of SAFETY_KW) {
    if (query.includes(k)) return { unsafe: true, keyword: k };
  }
  return { unsafe: false };
}

// ========== 生成初始 routing/tasks/emotions（用于实时显示）==========
export function buildInitialStates(query: string): {
  routing: RoutingStep[];
  tasks: TaskItem[];
  emotions: EmotionPoint[];
  state: {
    intent?: string;
    emotionLevel?: 'normal' | 'upset' | 'angry' | 'complaint';
    productModel?: string;
    productCategory?: string;
    currentNode?: string;
    action?: string;
    safety?: boolean;
    ambiguous?: boolean;
    candidates?: string[];
    path: any[];
    toolCalls: any[];
  };
} {
  const intent = inferIntent(query);
  const emotion = inferEmotion(query);
  const product = inferProductModel(query);
  const action = inferAction(intent.id, emotion.level);
  const safety = inferSafety(query);
  const ambiguous = !!product?.ambiguous;

  const now = Date.now();
  const routing: RoutingStep[] = [];
  const tasks: TaskItem[] = [];

  // 1. 情绪识别
  routing.push({
    id: 'init-emotion', type: 'emotion', label: '情绪识别',
    result: emotion.level + (emotion.trigger ? ` (${emotion.trigger})` : ''),
    timestamp: now, status: 'success',
  });
  tasks.push({
    id: 'init-emotion-task', title: `情绪分级 → ${emotion.level}`,
    status: 'completed', detail: emotion.trigger,
    timestamp: now,
  });

  // 2. 意图识别
  routing.push({
    id: 'init-intent', type: 'intent', label: '意图识别',
    result: intent.label, timestamp: now, status: 'success',
  });
  tasks.push({
    id: 'init-intent-task', title: `意图分类 → ${intent.label}`,
    status: 'completed', timestamp: now,
  });

  // 3. 路由选择
  routing.push({
    id: 'init-route', type: 'routing', label: '路由分发',
    result: `→ ${intent.label}分支`, timestamp: now, status: 'success',
  });
  tasks.push({
    id: 'init-route-task', title: `路由选择 → ${intent.label}handler`,
    status: 'in_progress', timestamp: now,
  });

  // 4. 安全检测（如果有）
  if (safety.unsafe) {
    routing.push({
      id: 'init-safety', type: 'escalation', label: '安全检测',
      result: `检测到危险词：${safety.keyword}`, timestamp: now, status: 'success',
    });
    tasks.push({
      id: 'init-safety-task', title: `⚠️ 安全警告：${safety.keyword}`,
      status: 'completed',
      detail: '应立即建议用户停止使用并升级 P0',
      timestamp: now,
    });
  }

  // 5. 当前动作
  routing.push({
    id: 'init-action', type: 'tool', label: '当前动作',
    result: action.label, timestamp: now, status: 'running',
  });

  // 5.5 产品消歧（如果型号歧义）
  if (ambiguous && product?.candidates) {
    routing.push({
      id: 'init-disambig', type: 'disambiguation', label: '产品消歧',
      result: `${product.candidates.length} 个候选`, timestamp: now, status: 'running',
    });
    tasks.push({
      id: 'init-disambig-task', title: `🔀 产品消歧：${product.model}`,
      status: 'in_progress',
      detail: '候选：' + product.candidates.join(' / '),
      timestamp: now,
    });
  }

  // 6. 情绪时间线
  const emotions: EmotionPoint[] = [
    { timestamp: now, level: emotion.level, trigger: emotion.trigger || query.slice(0, 20) },
  ];

  return {
    routing,
    tasks,
    emotions,
    state: {
      intent: intent.id,
      emotionLevel: emotion.level,
      productModel: product?.model,
      productCategory: product?.category,
      currentNode: safety.unsafe
        ? `安全警告(${safety.keyword})`
        : ambiguous
          ? `产品消歧(${product?.model})`
          : action.label,
      action: action.id,
      safety: safety.unsafe,
      ambiguous,
      candidates: product?.candidates,
      path: [
        { node: '情绪识别', choice: emotion.level, timestamp: now },
        { node: '意图分类', choice: intent.label, timestamp: now },
        { node: '路由分发', choice: action.label, timestamp: now },
        ...(ambiguous ? [{ node: '产品消歧', choice: product?.candidates?.join(' / '), timestamp: now }] : []),
      ],
      toolCalls: [],
    },
  };
}

// ========== 视觉证据解析（从 LLM 输出中匹配鼓包/漏液/起火等关键词）==========
export function inferVisionEvidence(query: string, attachments: Array<{ type: string; url: string }> = []): {
  product_model: string;
  fault_location: string;
  fault_phenomenon: string;
  confidence: number;
  is_anker_product: boolean;
} | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  const product = inferProductModel(query);
  const safety = inferSafety(query);
  return {
    product_model: product?.model || 'unknown',
    fault_location: '电池仓',
    fault_phenomenon: safety.keyword || 'unknown',
    confidence: 0.85,
    is_anker_product: !!product,
  };
}

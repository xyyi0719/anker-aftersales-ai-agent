/**
 * Dify 事件解析器 + 状态聚合
 * - 从 SSE 事件解析业务事件
 * - 合并初始推断（前端从 query 推断）和 LLM 真实输出
 */

import { useMemo } from 'react';
import type { DifyEvent, RoutingStep, TaskItem, RetrievalRecord, EmotionPoint, TroubleshootingState } from '../types';
import { buildInitialStates, inferVisionEvidence } from '../utils/inference';

interface UseEventParserOpts {
  events: DifyEvent[];
  initialQuery?: string;  // 当前对话的用户 query（用于初始状态推断）
  initialAttachments?: Array<{ type: string; url: string }>;
}

export function useEventParser({ events, initialQuery, initialAttachments }: UseEventParserOpts) {
  return useMemo(() => {
    const routing: RoutingStep[] = [];
    const tasks: TaskItem[] = [];
    const retrievals: RetrievalRecord[] = [];
    const emotions: EmotionPoint[] = [];
    const state: TroubleshootingState = {
      path: [],
      toolCalls: [],
    };

    // 1. 初始推断（在 LLM 返回前显示，让 UI 立即有状态）
    // P0-2 修复: 用 initialQuery 计算即时 emotion/intent/product
    if (initialQuery) {
      const init = buildInitialStates(initialQuery);
      routing.push(...init.routing);
      tasks.push(...init.tasks);
      emotions.push(...init.emotions);
      Object.assign(state, init.state);
      // 视觉证据（如果有附件）
      if (initialAttachments && initialAttachments.length > 0) {
        const ev = inferVisionEvidence(initialQuery, initialAttachments);
        if (ev) (state as any).visionEvidence = ev;
      }
    }

    // P0-2 修复: 每次 events 重新计算时，从 events 中**累积**情绪值（覆盖初始推断）
    // 处理逻辑下移，避免提前 return 跳出

    // 2. 处理 Dify 事件
    for (const e of events) {
      if (e.event === 'agent_thought') {
        parseThought(e.thought || '', routing, tasks, emotions, state);
      }
      if (e.event === 'tool_call') {
        const step: RoutingStep = {
          id: `route-tool-${Date.now()}-${routing.length}`,
          type: 'tool',
          label: `调用工具：${e.tool_name}`,
          result: summarizeToolOutput(e.tool_name, e.tool_output),
          timestamp: Date.now(),
          status: 'success',
        };
        routing.push(step);

        tasks.push({
          id: `task-tool-${Date.now()}-${tasks.length}`,
          title: e.tool_name,
          status: 'completed',
          detail: JSON.stringify(e.tool_input).slice(0, 80),
          timestamp: Date.now(),
        });

        if (e.tool_name === 'policy_retrieve') {
          const output = e.tool_output;
          retrievals.push({
            id: `retrieval-${Date.now()}-${retrievals.length}`,
            query: e.tool_input?.query || '',
            results: output?.results || [],
            confidence: output?.confidence || 0,
            answerable: output?.answerable || false,
            timestamp: Date.now(),
          });
        }
        if (e.tool_name === 'query_order' && e.tool_output) {
          state.productModel = state.productModel || e.tool_output.product_model;
          state.productCategory = state.productCategory || e.tool_output.product_category;
        }
        state.toolCalls.push({
          name: e.tool_name,
          input: e.tool_input,
          output: e.tool_output,
          timestamp: Date.now(),
          status: 'success' as const,
        });
      }

      if (e.event === 'message' || e.event === 'agent_message') {
        // 解析 message 中的 __STATE__{...}__STATE__ 标记（如果 handler prompt 输出过）
        // 用累积后的整段文本（因为 streaming 时 answer 是 delta）
        const fullAnswer = (state as any).__lastAnswer || '';
        (state as any).__lastAnswer = fullAnswer + (e.answer || '');
        const allText = (state as any).__lastAnswer as string;
        // P0-2 修复: 同时检测单条 delta 中的 __STATE__（避免 streaming 漏掉）
        const singleMatch = (e.answer || '').match(/__STATE__(\{[\s\S]*?\})__STATE__/);
        const stateMatch = singleMatch || allText.match(/__STATE__(\{[\s\S]*?\})__STATE__/);
        if (stateMatch) {
          // LLM 可能输出单引号 JSON（'intent' 而不是 "intent"），先尝试标准 JSON.parse，
          // 失败时把单引号替换成双引号再 parse
          let parsed: any = null;
          try {
            parsed = JSON.parse(stateMatch[1]);
          } catch {
            try {
              parsed = JSON.parse(stateMatch[1].replace(/'/g, '"'));
            } catch {
              // 还是失败，用 regex 提取关键字段
              parsed = {};
              const extract = (k: string) => {
                const m = stateMatch![1].match(new RegExp(`['"]?${k}['"]?\\s*:\\s*['"]?([^'",}]+)['"]?`));
                return m?.[1]?.trim();
              };
              parsed.intent = extract('intent');
              parsed.emotion = extract('emotion');
              parsed.product = extract('product');
              parsed.action = extract('action');
              parsed.current_node = extract('current_node');
            }
          }
          if (parsed) {
            // intent 标签映射：handler 输出的 'complaint_threat'/'urgent_escalation'/'emergency_escalation' → 'complaint'
            // 'transfer_to_human' → 'transfer_human'
            // 其他保持原值
            const intentMap: Record<string, string> = {
              complaint_threat: 'complaint',
              urgent_escalation: 'complaint',
              emergency_escalation: 'complaint',
              transfer_to_human: 'transfer_human',
            };
            if (parsed.intent) {
              const mapped = intentMap[parsed.intent] || parsed.intent;
              state.intent = mapped;
            }
            if (parsed.emotion) state.emotionLevel = parsed.emotion;
            // P0-2 修复: 每次 __STATE__ emotion 变化时往 emotions 时间线 push 一条
            if (parsed.emotion && parsed.emotion !== (state as any).__lastParsedEmotion) {
              emotions.push({
                timestamp: Date.now(),
                level: parsed.emotion as 'normal' | 'upset' | 'angry' | 'complaint',
                trigger: 'AI 判定',
              });
              (state as any).__lastParsedEmotion = parsed.emotion;
              routing.push({
                id: `route-emotion-llm-${Date.now()}`,
                type: 'emotion',
                label: '情绪识别（LLM）',
                result: parsed.emotion,
                timestamp: Date.now(),
                status: 'success',
              });
            }
            // H4-完整: 解析 emotion_intensity / emotion_history / consecutive_angry
            // 顺序重要：必须在 emotionLevel 更新后，因为 emotionIntensity 需要 emotionLevel 计算
            if (parsed.emotion_intensity) {
              state.emotionIntensity = parsed.emotion_intensity;
            } else if (parsed.emotion) {
              // fallback: 根据 emotion_level 推算 intensity
              state.emotionIntensity =
                parsed.emotion === 'complaint' ? 'L3_priority' :
                parsed.emotion === 'angry' || parsed.emotion === 'angry_escalated' ? 'L2_strong' :
                parsed.emotion === 'upset' ? 'L1_mild' :
                'L0_none';
            }
            if (parsed.emotion_trigger) state.emotionTrigger = parsed.emotion_trigger;
            if (typeof parsed.consecutive_angry === 'number') state.consecutiveAngry = parsed.consecutive_angry;
            if (parsed.emotion_history) {
              try {
                const hist = typeof parsed.emotion_history === 'string'
                  ? JSON.parse(parsed.emotion_history)
                  : parsed.emotion_history;
                if (Array.isArray(hist)) state.emotionHistory = hist;
              } catch {}
            }
            // 标记安抚已触发
            if (state.emotionIntensity && state.emotionIntensity !== 'L0_none') {
              state.empathyApplied = true;
            }
            // product（V3 用 'product' key，V2 用 'product_model' key，兼容两者）
            const productVal = parsed.product || parsed.product_model;
            if (productVal) state.productModel = productVal;
            if (parsed.current_node) state.currentNode = parsed.current_node;
            if (parsed.action) state.currentNode = state.currentNode || parsed.action;
            // 保存解析时间，让 ChatWindow 知道
            (state as any).__stateUpdatedAt = Date.now();
          }
        }
      }
    }

    return { routing, tasks, retrievals, emotions, state };
  }, [
    events,
    initialQuery,
    initialAttachments && initialAttachments.length,
    // P0-2: 让 emotion 跟随 events.length 变化（每条 message event 触发一次）
    events.length,
    // 让 last assistant message 的 content 也作为依赖（即使 events.length 没变）
    events.filter(e => e.event === 'message' || e.event === 'agent_message').map(e => (e as any).answer).join('')
  ]);
}

// ---------- 内部辅助 ----------

function parseThought(
  thought: string,
  routing: RoutingStep[],
  tasks: TaskItem[],
  emotions: EmotionPoint[],
  state: TroubleshootingState,
) {
  const t = thought.toLowerCase();

  if (t.includes('意图') || t.includes('intent')) {
    const intent = extractValue(thought, /意图[:：]\s*([^\s,，。]+)/);
    if (intent) {
      routing.push({
        id: `route-intent-${Date.now()}-${routing.length}`,
        type: 'intent',
        label: '意图识别',
        result: intent,
        timestamp: Date.now(),
        status: 'success',
      });
      state.intent = intent;
      tasks.push({
        id: `task-intent-${Date.now()}-${tasks.length}`,
        title: `意图分类 → ${intent}`,
        status: 'completed',
        timestamp: Date.now(),
      });
    }
  }

  if (t.includes('情绪') || t.includes('emotion')) {
    const level = extractEmotionLevel(thought);
    if (level) {
      routing.push({
        id: `route-emotion-${Date.now()}-${routing.length}`,
        type: 'emotion',
        label: '情绪识别',
        result: level,
        timestamp: Date.now(),
        status: 'success',
      });
      state.emotionLevel = level;
      emotions.push({
        timestamp: Date.now(),
        level,
        trigger: thought.slice(0, 50),
      });
      tasks.push({
        id: `task-emotion-${Date.now()}-${tasks.length}`,
        title: `情绪分级 → ${level}`,
        status: 'completed',
        detail: level === 'angry' || level === 'complaint' ? '⚠️ 触发升级' : undefined,
        timestamp: Date.now(),
      });
    }
  }

  if (t.includes('视觉') || t.includes('图片') || t.includes('vision') || t.includes('置信度')) {
    const conf = extractValue(thought, /置信度[:：]\s*([\d.]+)/);
    const skipMatch = thought.includes('跳级') || thought.includes('skip');
    routing.push({
      id: `route-vision-${Date.now()}-${routing.length}`,
      type: 'vision',
      label: skipMatch ? '视觉识别（跳级）' : '视觉识别',
      result: conf ? `置信度 ${conf}` : undefined,
      timestamp: Date.now(),
      status: 'success',
    });
  }

  if (t.includes('排障') || t.includes('故障树') || t.includes('troubleshoot')) {
    const node = extractValue(thought, /节点[:：]\s*([^\s,，。]+)/);
    routing.push({
      id: `route-state-${Date.now()}-${routing.length}`,
      type: 'troubleshooting',
      label: '排障状态机',
      result: node,
      timestamp: Date.now(),
      status: 'success',
    });
    state.currentNode = node;
  }

  if (t.includes('检索') || t.includes('policy_retrieve')) {
    routing.push({
      id: `route-policy-${Date.now()}-${routing.length}`,
      type: 'policy',
      label: '政策检索',
      timestamp: Date.now(),
      status: 'success',
    });
  }

  if (t.includes('转人工') || t.includes('escalat')) {
    routing.push({
      id: `route-escalation-${Date.now()}-${routing.length}`,
      type: 'escalation',
      label: '转人工',
      result: extractValue(thought, /P[012]/),
      timestamp: Date.now(),
      status: 'success',
    });
  }
}

function extractValue(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  return m?.[1];
}

function extractEmotionLevel(text: string): 'normal' | 'upset' | 'angry' | 'complaint' | undefined {
  if (text.includes('complaint') || text.includes('投诉')) return 'complaint';
  if (text.includes('angry') || text.includes('暴怒')) return 'angry';
  if (text.includes('upset') || text.includes('不满')) return 'upset';
  if (text.includes('normal') || text.includes('正常')) return 'normal';
  return undefined;
}

function summarizeToolOutput(toolName: string, output: any): string {
  if (!output) return '';
  if (typeof output === 'string') return output.slice(0, 60);

  switch (toolName) {
    case 'query_order':
      return output.order_id ? `${output.product_model} (${output.warranty_status})` : '查无此单';
    case 'check_warranty':
      return output.in_warranty ? `在保（剩余 ${output.days_remaining} 天）` : '过保';
    case 'create_ticket':
      return output.ticket_id ? `工单 ${output.ticket_id}` : '失败';
    case 'policy_retrieve':
      return `置信度 ${(output.confidence * 100).toFixed(0)}%`;
    default:
      return JSON.stringify(output).slice(0, 60);
  }
}

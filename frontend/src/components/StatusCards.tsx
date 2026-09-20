/**
 * 状态卡片 - 顶部 6 张关键状态卡
 * 让所有关键状态一眼可见，不需 tab 切换
 * P0-2: emotion 变化时高亮闪烁
 */

import { useEffect, useRef, useState } from 'react';
import type { TroubleshootingState } from '../types';

interface Props {
  state: TroubleshootingState;
  isStreaming?: boolean;
}

const INTENT_LABEL: Record<string, string> = {
  // 标准 6 类
  troubleshooting: '故障报修',
  inquiry: '咨询',
  return_or_exchange: '退换',
  transfer_human: '转人工',
  complaint: '投诉',
  out_of_scope: '兜底',
  // handler 实际可能输出的变体（LLM 自由发挥，需要映射回 6 类）
  complaint_threat: '投诉',
  complaint_escalation: '投诉',
  urgent_complaint: '投诉',
  urgent_escalation: '投诉',
  emergency_escalation: '投诉',
  complaint_handling: '投诉',
  transfer_to_human: '转人工',
  human_handoff: '转人工',
  handoff: '转人工',
  troubleshoot: '故障报修',
  repair: '故障报修',
  fault: '故障报修',
  return: '退换',
  refund: '退换',
  exchange: '退换',
  consultation: '咨询',
  question: '咨询',
  chitchat: '兜底',
  off_topic: '兜底',
};

const EMOTION_LABEL: Record<string, string> = {
  normal: '平静',
  neutral: '平静',
  upset: '不满',
  angry: '暴怒',
  angry_escalated: '暴怒🔥升级',
  complaint: '投诉风险',
  // handler 可能输出的变体
  calm: '平静',
  happy: '平静',
  annoyed: '不满',
  frustrated: '不满',
  furious: '暴怒',
  rage: '暴怒',
  threatening: '投诉风险',
};

const EMOTION_COLOR: Record<string, string> = {
  normal: 'var(--color-success)',
  neutral: 'var(--color-success)',
  upset: 'var(--color-warning)',
  angry: 'var(--color-danger)',
  angry_escalated: 'var(--color-danger)',
  complaint: 'var(--color-danger)',
  calm: 'var(--color-success)',
  happy: 'var(--color-success)',
  annoyed: 'var(--color-warning)',
  frustrated: 'var(--color-warning)',
  furious: 'var(--color-danger)',
  rage: 'var(--color-danger)',
  threatening: 'var(--color-danger)',
};

// 安抚强度档位映射（来自 emotion_node.emotion_intensity）
const INTENSITY_LABEL: Record<string, string> = {
  L0_none: '不触发',
  L1_mild: '轻度安抚',
  L2_strong: '强安抚',
  L3_priority: '优先通道',
};

const INTENSITY_COLOR: Record<string, string> = {
  L0_none: 'var(--color-text-muted)',
  L1_mild: 'var(--color-warning)',
  L2_strong: 'var(--color-danger)',
  L3_priority: '#dc2626',
};

export default function StatusCards({ state, isStreaming }: Props) {
  const pathSteps = state.path?.length || 0;
  const toolCount = state.toolCalls?.length || 0;
  const safety = (state as any).safety;

  // P0-2: emotion 变化时短暂高亮
  const prevEmotion = useRef(state.emotionLevel);
  const [pulseEmotion, setPulseEmotion] = useState(false);
  useEffect(() => {
    if (prevEmotion.current !== state.emotionLevel && state.emotionLevel) {
      setPulseEmotion(true);
      const t = setTimeout(() => setPulseEmotion(false), 800);
      prevEmotion.current = state.emotionLevel;
      return () => clearTimeout(t);
    }
  }, [state.emotionLevel]);

  // P0-2: intent 变化时也高亮
  const prevIntent = useRef(state.intent);
  const [pulseIntent, setPulseIntent] = useState(false);
  useEffect(() => {
    if (prevIntent.current !== state.intent && state.intent) {
      setPulseIntent(true);
      const t = setTimeout(() => setPulseIntent(false), 800);
      prevIntent.current = state.intent;
      return () => clearTimeout(t);
    }
  }, [state.intent]);

  return (
    <div className="status-cards">
      <Card
        icon="🎯"
        label="意图"
        value={state.intent ? INTENT_LABEL[state.intent] || state.intent : '—'}
        sub={isStreaming ? '识别中...' : ''}
        active={!!state.intent}
        pulse={pulseIntent}
      />
      <Card
        icon="💢"
        label="情绪"
        value={state.emotionLevel ? EMOTION_LABEL[state.emotionLevel] || state.emotionLevel : '—'}
        sub={
          state.emotionIntensity && state.emotionIntensity !== 'L0_none'
            ? `🤗 ${INTENSITY_LABEL[state.emotionIntensity] || state.emotionIntensity}` +
              (state.consecutiveAngry && state.consecutiveAngry >= 2 ? ` ×${state.consecutiveAngry}` : '')
            : safety ? '⚠️ 危险' : ''
        }
        color={state.emotionLevel ? EMOTION_COLOR[state.emotionLevel] : undefined}
        active={!!state.emotionLevel}
        pulse={pulseEmotion}
      />
      <Card
        icon="📦"
        label="产品"
        value={state.productModel || '—'}
        sub={
          state.ambiguous
            ? '🔀 歧义: ' + (state.candidates || []).map(c => c.replace(/^eufy\s+/i, '')).join(' / ')
            : state.productCategory || ''
        }
        active={!!state.productModel}
        warning={state.ambiguous}
      />
      <Card
        icon="🌲"
        label="节点"
        value={state.currentNode || '—'}
        sub=""
        active={!!state.currentNode}
      />
      <Card
        icon="👣"
        label="路径步数"
        value={String(pathSteps)}
        sub=""
        active={pathSteps > 0}
      />
      <Card
        icon="🔧"
        label="工具调用"
        value={String(toolCount)}
        sub=""
        active={toolCount > 0}
      />
    </div>
  );
}

function Card({
  icon, label, value, sub, active, color, warning, pulse,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  active?: boolean;
  color?: string;
  warning?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className={`status-card ${active ? 'active' : ''} ${warning ? 'warning' : ''} ${pulse ? 'pulse' : ''}`}>
      <div className="status-card-head">
        <span className="status-card-icon">{icon}</span>
        <span className="status-card-label">{label}</span>
      </div>
      <div className="status-card-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="status-card-sub">{sub}</div>}
    </div>
  );
}
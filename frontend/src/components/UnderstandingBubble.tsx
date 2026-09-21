import type { UserInsight } from '../types';

// 契约 B：情绪档位只渲染模型判定的值
const EMOTION_LABELS: Record<string, string> = {
  L0: '平静',
  L1: '不满',
  L2: '明显愤怒',
  L3: '投诉风险',
};

const INTENT_LABELS: Record<string, string> = {
  troubleshooting: '故障报修',
  inquiry: '咨询',
  return_or_exchange: '退换货',
  transfer_human: '转人工',
  complaint: '投诉',
  out_of_scope: '超出服务范围',
};

// 只挂在用户消息下方：展示系统听懂了什么。未识别到的项不显示该行。
export default function UnderstandingBubble({ emotion, intents, product, keyInfo }: UserInsight) {
  const emotionLabel = emotion ? EMOTION_LABELS[emotion] : undefined;
  const intentLabels = (intents || []).map(i => INTENT_LABELS[i]).filter(Boolean);
  const understood = [...intentLabels, product, keyInfo].filter(Boolean) as string[];

  if (!emotionLabel && understood.length === 0) return null;

  return (
    <div className="understanding-bubble">
      {emotionLabel && (
        <div className="ub-line">
          <span className="ub-ico">⚡</span> 情绪：{emotionLabel}（{emotion}）
        </div>
      )}
      {understood.length > 0 && (
        <div className="ub-line">
          <span className="ub-ico">🎯</span> 理解为：{understood.join(' · ')}
        </div>
      )}
    </div>
  );
}

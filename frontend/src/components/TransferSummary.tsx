/**
 * TransferSummary - 转人工结构化摘要显示
 * 从 LLM 输出中解析 __STATE__...__SUMMARY_END__ 之间的 JSON 摘要
 */
import { useMemo } from 'react';

export interface TransferSummaryData {
  intent?: string;
  problem?: string;
  diagnosis?: string;
  order_id?: string;
  product?: string;
  emotion_level?: string;
  tool_calls_count?: number;
}

interface Props {
  messages: Array<{ role: string; content: string }>;
}

const INTENT_LABEL: Record<string, string> = {
  troubleshooting: '故障报修',
  inquiry: '咨询',
  return_or_exchange: '退换',
  transfer_human: '转人工',
  complaint: '投诉',
  out_of_scope: '兜底',
};

const EMOTION_LABEL: Record<string, string> = {
  normal: '平静',
  upset: '不满',
  angry: '暴怒',
  complaint: '投诉风险',
};

export default function TransferSummary({ messages }: Props) {
  // 找最新一条 assistant 消息中包含 __SUMMARY_END__ 的 JSON 摘要
  const summary = useMemo<TransferSummaryData | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const c = m.content || '';
      const summaryMatch = c.match(/__SUMMARY_END__\s*([\s\S]*?)__SUMMARY_END__/);
      if (summaryMatch) continue; // 跳过旧分隔符匹配
      // 找 JSON 摘要: 在 __STATE__ 与 __SUMMARY_END__ 之间
      const stateMatch = c.match(/__STATE__\{[\s\S]*?\}__STATE__\s*([\s\S]*?)__SUMMARY_END__/);
      if (stateMatch) {
        const jsonStr = stateMatch[1].trim();
        // 多种 JSON 格式尝试
        const tryParse = (s: string): any => {
          try { return JSON.parse(s); } catch {}
          try { return JSON.parse(s.replace(/'/g, '"')); } catch {}
          // Per-key regex
          const parsed: any = {};
          for (const k of ['intent', 'problem', 'diagnosis', 'order_id', 'product', 'emotion_level', 'tool_calls_count']) {
            const m = s.match(new RegExp(`['"]?${k}['"]?\\s*:\\s*['"]?([^'",}]+)['"]?`));
            if (m) parsed[k] = m[1];
          }
          return Object.keys(parsed).length > 0 ? parsed : null;
        };
        const parsed = tryParse(jsonStr);
        if (parsed) return parsed;
      }
    }
    return null;
  }, [messages]);

  if (!summary) return null;

  // 检查必要字段（至少要有 problem）
  if (!summary.problem && !summary.intent) return null;

  return (
    <div className="transfer-summary" style={{
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-danger)',
      borderRadius: 8,
      padding: 12,
      margin: '8px 12px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        color: 'var(--color-danger)',
        fontWeight: 600,
        fontSize: 13,
      }}>
        <span>📋</span>
        <span>转人工摘要</span>
      </div>
      <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
        {summary.intent && (
          <Row label="意图" value={INTENT_LABEL[summary.intent] || summary.intent} />
        )}
        {summary.problem && (
          <Row label="问题" value={summary.problem} highlight />
        )}
        {summary.diagnosis && summary.diagnosis !== 'unknown' && (
          <Row label="诊断" value={summary.diagnosis} />
        )}
        {summary.order_id && (
          <Row label="订单" value={summary.order_id} mono />
        )}
        {summary.product && (
          <Row label="产品" value={summary.product} />
        )}
        {summary.emotion_level && (
          <Row label="情绪" value={EMOTION_LABEL[summary.emotion_level] || summary.emotion_level} />
        )}
        {summary.tool_calls_count != null && (
          <Row label="工具调用" value={`${summary.tool_calls_count} 次`} />
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--color-text-faint)', flex: '0 0 56px', textAlign: 'right' }}>
        {label}
      </span>
      <span style={{
        flex: 1,
        color: highlight ? 'var(--color-text)' : 'var(--color-text-secondary)',
        fontWeight: highlight ? 600 : 400,
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}
import type { TaskItem } from '../types';

// 诉求标签：kind → 中文 + 配色（见 docs/V2/spec/B1-三层看板.md）
const KIND_META: Record<string, { label: string; color: string }> = {
  troubleshooting: { label: '排障', color: '#38bdf8' },
  warranty: { label: '核保', color: '#06b6d4' },
  policy: { label: '退货/退款', color: '#f59e0b' },
  order: { label: '订单', color: '#94a3b8' },
  product: { label: '型号确认', color: '#94a3b8' },
  scope: { label: '边界拒答', color: '#f59e0b' },
  recall: { label: '召回核验', color: '#f59e0b' },
  safety: { label: '安全', color: '#dc2626' },
  emotion: { label: '投诉', color: '#ef4444' },
  vision: { label: '看图', color: '#38bdf8' },
  faq: { label: '咨询', color: '#94a3b8' },
  handoff: { label: '交接', color: '#ef4444' },
};

interface Props {
  summary?: string;
  tasks: TaskItem[];
}

export default function SessionSummary({ summary, tasks }: Props) {
  // 只展示能映射到已知 kind 的诉求，去重并保留出现顺序
  const kinds: string[] = [];
  tasks.forEach(t => {
    if (t.title && KIND_META[t.title] && !kinds.includes(t.title)) kinds.push(t.title);
  });

  return (
    <section className="layer-summary" aria-label="会话摘要与诉求">
      <h3 className="layer-title">本次会话</h3>
      <p className="summary-text">{summary && summary.trim() ? summary : '暂无会话摘要'}</p>
      {kinds.length > 0 && (
        <div className="demand-tags">
          <span className="demand-label">诉求</span>
          {kinds.map(k => {
            const meta = KIND_META[k];
            return (
              <span
                key={k}
                data-kind={k}
                className="demand-tag"
                style={{ color: meta.color, borderColor: meta.color, background: `${meta.color}22` }}
              >
                {meta.label}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

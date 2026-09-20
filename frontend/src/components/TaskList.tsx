import type { TaskItem, TroubleshootingState } from '../types';

interface Props {
  tasks: TaskItem[];
  state: TroubleshootingState;
}

const STATUS_ICONS = {
  pending: '○',
  in_progress: '⏳',
  completed: '✓',
  failed: '✗',
};

export default function TaskList({ tasks, state }: Props) {
  return (
    <div>
      {/* 当前状态卡片 */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <div style={{ color: 'var(--color-text-dim)', marginBottom: 6 }}>当前会话状态</div>
        <Row label="意图" value={state.intent || '—'} />
        <Row label="情绪" value={state.emotionLevel || 'normal'} />
        <Row label="产品型号" value={state.productModel || '—'} />
        <Row label="排障节点" value={state.currentNode || '—'} />
        <Row label="路径步数" value={String(state.path.length)} />
        <Row label="工具调用" value={String(state.toolCalls.length)} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>任务列表</div>

      {tasks.length === 0 ? (
        <div className="empty-state" style={{ padding: 16 }}>
          暂无任务
        </div>
      ) : (
        <div className="task-list">
          {tasks.map(t => (
            <div key={t.id} className={`task-item status-${t.status}`}>
              <div className="task-icon">{STATUS_ICONS[t.status]}</div>
              <div className="task-content">
                <div className="task-title">{t.title}</div>
                {t.detail && <div className="task-detail">{t.detail}</div>}
                <div className="task-time">
                  {new Date(t.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--color-text-faint)' }}>{label}</span>
      <span style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  );
}
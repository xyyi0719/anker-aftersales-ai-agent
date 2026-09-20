import type { RetrievalRecord } from '../types';

interface Props {
  retrievals: RetrievalRecord[];
}

export default function RetrievalLog({ retrievals }: Props) {
  if (retrievals.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📜</div>
          <div>暂无检索记录</div>
          <div style={{ fontSize: 12, marginTop: 8, color: 'var(--color-text-faint)' }}>
            当 AI 调用 policy_retrieve 工具时<br />会显示查询内容和检索到的政策条款
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="retrieval-log">
      {retrievals.map(r => {
        const level = r.confidence >= 0.7 ? 'high' : r.confidence >= 0.4 ? 'medium' : 'low';
        return (
          <div key={r.id} className="retrieval-record">
            <div className="retrieval-record-header">
              <div className="retrieval-query">
                {r.query || '(空查询)'}
              </div>
              <div className={`retrieval-confidence ${level}`}>
                {(r.confidence * 100).toFixed(0)}%
              </div>
            </div>

            {r.answerable ? (
              <div style={{ fontSize: 11, color: 'var(--color-success)', marginBottom: 8 }}>
                ✓ 命中，将带出处返回
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--color-warning)', marginBottom: 8 }}>
                ⚠ 低置信度，将触发诚实升级
              </div>
            )}

            {r.results.length > 0 ? (
              <div className="retrieval-results">
                {r.results.slice(0, 3).map((chunk, i) => (
                  <div key={i} className="retrieval-chunk">
                    <div className="retrieval-chunk-meta">
                      <span>{chunk.metadata?.article || chunk.chunk_id}</span>
                      <span>score: {(chunk.score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="retrieval-chunk-text">
                      {chunk.text.slice(0, 120)}
                      {chunk.text.length > 120 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
                无结果
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
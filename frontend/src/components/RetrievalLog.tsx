import type { RetrievalRecord } from '../types';
import { IconSourceQuote, IconCheckCircle, IconAlertTriangle } from './SvgIcons';

interface Props {
  retrievals: RetrievalRecord[];
}

export default function RetrievalLog({ retrievals }: Props) {
  if (retrievals.length === 0) {
    return (
      <div className="retrieval-empty-state">
        <IconSourceQuote size={32} color="#64748b" />
        <div className="empty-title">暂无知识库检索记录</div>
        <div className="empty-subtitle">
          当对话触发政策问答、保修查询或召回核验时，在此展示检索命中率与知识切片。
        </div>
      </div>
    );
  }

  return (
    <div className="retrieval-log-list">
      {retrievals.map(r => {
        const level = r.confidence >= 0.7 ? 'high' : r.confidence >= 0.4 ? 'medium' : 'low';
        return (
          <div key={r.id} className="retrieval-record-card">
            <div className="retrieval-card-header">
              <div className="retrieval-query-text">
                <span className="query-prefix">检索词：</span>"{r.query || '(空查询)'}"
              </div>
              <div className={`retrieval-confidence-pill ${level}`}>
                置信度 {(r.confidence * 100).toFixed(0)}%
              </div>
            </div>

            <div className="retrieval-verdict-line">
              {r.answerable ? (
                <div className="verdict-tag success">
                  <IconCheckCircle size={14} />
                  <span>置信度达标 · 锁定条款出处安全作答</span>
                </div>
              ) : (
                <div className="verdict-tag warning">
                  <IconAlertTriangle size={14} />
                  <span>置信度不足门限 · 诚实升级专员（绝不瞎编）</span>
                </div>
              )}
            </div>

            {r.results.length > 0 ? (
              <div className="retrieval-chunks-grid">
                {r.results.slice(0, 3).map((chunk, i) => (
                  <div key={i} className="retrieval-chunk-item">
                    <div className="chunk-meta-row">
                      <strong className="chunk-id-tag">
                        {chunk.metadata?.article || chunk.chunk_id}
                      </strong>
                      <span className="chunk-score-tag">
                        匹配度: {(chunk.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="chunk-body-text">
                      {chunk.text.slice(0, 140)}
                      {chunk.text.length > 140 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="retrieval-no-chunks">未检索到匹配的官方条文</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
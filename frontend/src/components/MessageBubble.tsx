import { useMemo } from 'react';
import type { ChatMessage, UserInsight } from '../types';
import {
  IconUser,
  IconAnkerLogo,
  IconSourceQuote,
  IconExternalLink,
  IconSparkles,
} from './SvgIcons';
import UnderstandingBubble from './UnderstandingBubble';
import { safeSource } from '../utils/evidence';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
  /** 仅最后一条用户消息带：情绪与理解辅助（B2） */
  insight?: UserInsight;
}

export default function MessageBubble({ message, isStreaming, insight }: Props) {
  const isUser = message.role === 'user';
  const rawContent = message.content || '';

  // 清理正文中的系统元数据标记
  const cleanContent = useMemo(() => {
    return rawContent
      .replace(/__EVIDENCE_V1__[A-Za-z0-9+/=]+__EVIDENCE_END__/g, '')
      .replace(/__STATE__\{[\s\S]*?\}__STATE__/g, '')
      .replace(/__PRODUCT_DISAMBIG__[\s\S]*?__PRODUCT_DISAMBIG_END__/g, '')
      .replace(/__SUMMARY_END__[\s\S]*?__SUMMARY_END__/g, '')
      .trim();
  }, [rawContent]);

  const citations = message.retrieverResources || [];

  return (
    <article className={`message-bubble-row ${isUser ? 'user-side' : 'ai-side'}`}>
      <div className="message-avatar-wrap">
        {isUser ? (
          <div className="avatar user-avatar">
            <IconUser size={18} color="#ffffff" />
          </div>
        ) : (
          <div className="avatar ai-avatar">
            <IconAnkerLogo size={20} color="#00d4ff" />
          </div>
        )}
      </div>

      <div className="message-bubble-main">
        <div className="message-header-meta">
          <span className="sender-name">{isUser ? '消费者' : 'Anker 智能客服'}</span>
          <span className="timestamp">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <div className="bubble-card">
          {cleanContent ? (
            <div className="bubble-text-content">{cleanContent}</div>
          ) : !isUser ? (
            <div className="ai-typing-placeholder">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-tip">正在遵循 SOP 规则检索核对中...</span>
            </div>
          ) : (
            <div className="bubble-text-content muted">[仅发送了附件照片]</div>
          )}

          {/* 图片附件展示 */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="attached-media-grid">
              {message.attachments.map((img, i) => (
                <div key={i} className="attached-media-item">
                  <img src={img.url} alt={`附图 ${i + 1}`} className="attached-img" />
                  <span className="attached-tag">故障照片 {i + 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* 出处锁：政策条款引用溯源抽屉 */}
          {!isUser && citations.length > 0 && (
            <details className="citation-accordion">
              <summary className="citation-summary-btn">
                <div className="summary-left">
                  <IconSourceQuote size={14} color="#0084ff" />
                  <span>参考了 {citations.length} 条官方依据</span>
                </div>
                <span className="summary-tag">已通过元数据核验</span>
              </summary>
              <div className="citation-drawer-body">
                {citations.map((r, i) => {
                  const score = typeof r.score === 'number' ? `${(r.score * 100).toFixed(0)}%` : '高匹配';
                  return (
                    <div key={i} className="citation-clause-card">
                      <div className="clause-header">
                        <strong className="clause-title">
                          📄 {r.document_name || r.dataset_name || `条款片段 ${r.segment_id?.slice(0, 8) || i + 1}`}
                        </strong>
                        <span className="clause-score">相关度: {score}</span>
                      </div>
                      <p className="clause-snippet">{r.content || '按 SOP 规则切片提取的官方正文'}</p>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* 思考过程（若有） */}
          {!isUser && message.thinking && (
            <details className="thinking-accordion">
              <summary className="thinking-summary-btn">
                <IconSparkles size={14} color="#8b5cf6" />
                <span>查看 Agent 决策思维链 (Thinking Process)</span>
              </summary>
              <pre className="thinking-content">{message.thinking}</pre>
            </details>
          )}
        </div>

        {isUser && insight && <UnderstandingBubble {...insight} />}
      </div>
    </article>
  );
}

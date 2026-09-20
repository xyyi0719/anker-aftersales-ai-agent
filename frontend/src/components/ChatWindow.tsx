import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (text: string, files?: Array<{ type: string; url: string }>) => void;
  onReset: () => void;
  error: string | null;
  retryAttempt: number;
}

export default function ChatWindow({ messages, isStreaming, onSend, onReset, error, retryAttempt }: Props) {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动滚到底
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    onSend(text, images.map(url => ({ type: 'image', url })));
    setInput('');
    setImages([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const promises = Array.from(files).map(
      file =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );

    Promise.all(promises).then(urls => {
      setImages(prev => [...prev, ...urls]);
    });

    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="chat">
      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <div>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
              <div>你好，我是 Anker 售后 AI 助手</div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                试试：「我的 Anker 737 鼓包了」「保修多久？」「我要退货」
              </div>
            </div>
          </div>
        ) : (
          messages.map(m => <MessageBubble key={m.id} message={m} />)
        )}
        {error && (
          <div style={{ color: 'var(--color-danger)', fontSize: 12, padding: 8 }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <div className="chat-input">
        {images.length > 0 && (
          <div className="image-preview">
            {images.map((url, i) => (
              <div key={i} className="image-preview-item">
                <img src={url} alt="" />
                <button
                  className="image-preview-remove"
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'AI 正在思考…' : '输入消息，回车发送，Shift+Enter 换行'}
            disabled={isStreaming}
            rows={1}
          />
        </div>
        <div className="chat-input-actions">
          <span className="upload-hint">
            {retryAttempt > 0 ? `⏳ 重试中 (${retryAttempt}/3)…` : isStreaming ? 'AI 响应中…' : '提示：上传故障图片可触发视觉跳级'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => fileRef.current?.click()}
            disabled={isStreaming}
            title="上传图片"
          >
            📷
          </button>
          <button
            className="btn btn-secondary btn-icon"
            onClick={onReset}
            disabled={isStreaming}
            title="清空对话"
          >
            🗑
          </button>
          <button
            className="btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <span className="spinner" /> : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  // 去掉 __STATE__{...}__STATE__ 标记（这是 metadata，不显示给用户）
  const displayContent = (message.content || '').replace(/__STATE__\{[\s\S]*?\}__STATE__/g, '').trim();

  return (
    <div className={`msg ${isUser ? 'user' : 'assistant'}`}>
      <div className="msg-avatar">{isUser ? '我' : 'AI'}</div>
      <div>
        <div className="msg-bubble">
          {displayContent}
          {!isUser && message.content === '' && (
            <span className="streaming-cursor" />
          )}
        </div>

        {!isUser && message.thinking && (
          <details className="msg-thought">
            <summary style={{ cursor: 'pointer' }}>💭 思考过程</summary>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6, fontSize: 11 }}>
              {message.thinking}
            </pre>
          </details>
        )}

        {/* P0-4 修复: 出处锁 UI - 显示 retriever_resources 检索来源 */}
        {!isUser && message.retrieverResources && message.retrieverResources.length > 0 && (
          <details className="msg-source" style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              📜 出处锁 · 引用了 {message.retrieverResources.length} 条政策条款
            </summary>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {message.retrieverResources.map((r, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: 8,
                    background: 'var(--color-bg-elevated)',
                    borderLeft: '3px solid var(--color-primary)',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ color: 'var(--color-primary)' }}>
                      📄 {r.document_name || r.dataset_name || `chunk-${r.segment_id?.slice(0, 8) || '?'}`}
                    </strong>
                    <span style={{ color: 'var(--color-text-faint)', fontSize: 10 }}>
                      score: {((r.score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ color: 'var(--color-text)', lineHeight: 1.5 }}>
                    {(r.content || '').slice(0, 200)}{(r.content || '').length > 200 ? '…' : ''}
                  </div>
                  {r.segment_id && (
                    <div style={{ marginTop: 4, color: 'var(--color-text-faint)', fontSize: 10 }}>
                      chunk_id: {r.segment_id.slice(0, 12)}…
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <details className="msg-tool">
            <summary style={{ cursor: 'pointer' }}>
              🔧 调用了 {message.toolCalls.length} 个工具
            </summary>
            <div style={{ marginTop: 6 }}>
              {message.toolCalls.map((tc, i) => (
                <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>
                  <strong>{tc.name}</strong>({JSON.stringify(tc.input).slice(0, 50)})
                  {tc.output && <span> → {JSON.stringify(tc.output).slice(0, 50)}</span>}
                </div>
              ))}
            </div>
          </details>
        )}

        {isUser && message.attachments && message.attachments.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {message.attachments.map((a, i) => (
              <img key={i} src={a.url} alt="" className="msg-image" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { ChatMessage, OptionChip, UserInsight } from '../types';
import MessageBubble from './MessageBubble';
import OptionChips from './OptionChips';
import {
  IconSend,
  IconTrash,
  IconCameraVision,
  IconSparkles,
  IconAlertTriangle,
  IconAnkerLogo,
} from './SvgIcons';

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (text: string, files?: Array<{ type: string; url: string }>) => void;
  onReset: () => void;
  error: string | null;
  /** 仅挂到最后一条用户消息下方（B2） */
  userInsight?: UserInsight;
  /** 仅挂到最后一条 AI 消息下方：可点选项芯片（B2） */
  assistantOptions?: OptionChip[];
}

const DEMO_PRESETS: Array<{ label: string; query: string; icon?: string }> = [
  { label: '这个型号有召回吗', query: '你们这个充电宝有过召回吗？听说会爆炸是真的吗？' },
  { label: '我的 S1 Pro 不吸了', query: '我的 S1 Pro 怎么不吸了？' },
  { label: 'Anker 737 充不进电', query: 'Anker 737 充不进电，换过线还是没反应' },
  { label: '我要投诉', query: '刚买一个月就坏了！售后踢皮球，垃圾客服！我要投诉到底！' },
];

export default function ChatWindow({
  messages,
  isStreaming,
  onSend,
  onReset,
  error,
  userInsight,
  assistantOptions,
}: Props) {
  const lastUserId = [...messages].reverse().find(m => m.role === 'user')?.id;
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSend = () => {
    const text = input.trim();
    if (isStreaming) return;
    if (!text && images.length === 0) return;

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

    const fileList = Array.from(files);
    if (images.length + fileList.length > 3) {
      alert('最多支持上传 3 张故障图片');
      return;
    }

    Promise.all(
      fileList.map(
        file =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    ).then(urls => {
      setImages(prev => [...prev, ...urls]);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="chat-window-container">
      {/* 顶部：评委演示场景快捷预设条 */}
      <div className="demo-presets-strip">
        <span className="presets-label">
          <IconSparkles size={14} color="#0084ff" />
          <span>快捷提问：</span>
        </span>
        <div className="presets-buttons">
          {DEMO_PRESETS.map((p, idx) => (
            <button
              key={idx}
              className="preset-chip-btn"
              disabled={isStreaming}
              onClick={() => onSend(p.query)}
              title={p.query}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 消息滚动区域 */}
      <div className="chat-messages-area" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-welcome-box">
            <div className="welcome-logo-badge">
              <IconAnkerLogo size={36} color="#0084ff" />
            </div>
            <h2>Anker 智能售后服务</h2>
            <p className="welcome-subtitle">
              描述您遇到的问题，或上传故障照片；也可以直接点下面的常见问题。
            </p>
          </div>
        ) : (
          messages.map(m => (
            <MessageBubble
              key={m.id}
              message={m}
              isStreaming={isStreaming}
              insight={m.role === 'user' && m.id === lastUserId ? userInsight : undefined}
            />
          ))
        )}

        {error && (
          <div className="chat-error-toast">
            <IconAlertTriangle size={16} color="#ef4444" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 底部输入交互区 */}
      <div className="chat-composer-panel">
        {/* 快速模拟对话：本轮追问选项，点一下就替用户说出下一句话 */}
        {!isStreaming && assistantOptions && assistantOptions.length > 0 && (
          <div className="quick-dialog" aria-label="快速模拟对话">
            <span className="quick-dialog-label">快速模拟对话</span>
            <OptionChips options={assistantOptions} onSelect={onSend} />
          </div>
        )}

        {images.length > 0 && (
          <div className="composer-previews-bar">
            {images.map((src, i) => (
              <div key={i} className="composer-preview-item">
                <img src={src} alt={`待发送图片 ${i + 1}`} />
                <button
                  className="preview-remove-btn"
                  onClick={() => setImages(v => v.filter((_, j) => i !== j))}
                  title="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="composer-textarea-wrap">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'AI 正在按照 SOP 流程排障与调用工具中...'
                : '请描述您的产品故障，或上传照片（Enter 发送，Shift + Enter 换行）...'
            }
            disabled={isStreaming}
            rows={2}
          />
        </div>

        <div className="composer-actions-row">
          <div className="actions-left">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              hidden
              onChange={handleFileChange}
            />
            <button
              className="action-btn icon-btn"
              disabled={isStreaming}
              onClick={() => fileInputRef.current?.click()}
              title="上传故障照片 (最多3张)"
            >
              <IconCameraVision size={18} />
              <span>上传图片</span>
            </button>

            <button
              className="action-btn icon-btn text-danger"
              disabled={messages.length === 0 || isStreaming}
              onClick={onReset}
              title="清空会话记录"
            >
              <IconTrash size={16} />
              <span>新会话</span>
            </button>
          </div>

          <div className="actions-right">
            <button
              className="send-primary-btn"
              disabled={isStreaming || (!input.trim() && images.length === 0)}
              onClick={handleSend}
            >
              {isStreaming ? (
                <>
                  <span className="spinner-mini white" />
                  <span>处理中</span>
                </>
              ) : (
                <>
                  <span>发送咨询</span>
                  <IconSend size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

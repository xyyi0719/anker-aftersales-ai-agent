/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useDifyChat } from './hooks/useDifyChat';
import { useEventParser } from './hooks/useEventParser';
import ChatWindow from './components/ChatWindow';
import SidePanel from './components/SidePanel';
import TransferSummary from './components/TransferSummary';

const API_URL = import.meta.env.VITE_DIFY_API_URL || '';
const API_KEY = import.meta.env.VITE_DIFY_API_KEY || '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export default function App() {
  const { messages, conversationId, events, isStreaming, isRetrying, retryAttempt, error, send, reset } = useDifyChat({
    apiUrl: API_URL,
    apiKey: API_KEY,
    userId: 'demo-user-001',
  });

  // 包含 retry 状态的总 busy
  const isBusy = isStreaming || isRetrying;

  // 跟踪最近一条 user 消息的 query，用于初始状态推断
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const initialQuery = lastUserMsg?.content || '';
  const initialAttachments = lastUserMsg?.attachments;

  const { routing, tasks, retrievals, emotions, state } = useEventParser({
    events,
    initialQuery,
    initialAttachments,
  });

  // 演示钩子截图快捷按钮
  const demoScenarios: Array<{ label: string; query: string; image?: boolean }> = [
    { label: '📷 看图跳级', query: '我充电宝鼓包了（上传图片）', image: true },
    { label: '🔀 S1 Pro 歧义', query: '我的 S1 Pro 不吸了' },
    { label: '😡 暴怒升级', query: '我买的 Anker 737 才一个月就鼓包了！气死我了！' },
    { label: '📜 政策检索', query: '这个型号有召回吗？' },
  ];

  const handleSend = (text: string, files?: Array<{ type: string; url: string }>) => {
    send({ query: text, files });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="logo">A</span>
          Anker 售后 AI 工作台
          <span style={{ fontSize: 11, color: 'var(--color-text-faint)', marginLeft: 8 }}>
            新航无Bug · 赛道04
          </span>
        </h1>
        <div className="meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="status-dot" />
            <span>{USE_MOCK ? '演示模式' : 'Dify 已连接'}</span>
          </div>
          {conversationId && (
            <span style={{ fontSize: 11 }} title={conversationId}>
              对话 {conversationId.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      <main className="app-main">
        <section className="left">
          <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-faint)', alignSelf: 'center', marginRight: 4 }}>快速试用：</span>
            {demoScenarios.map(s => (
              <button
                key={s.label}
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => {
                  if (s.image) {
                    const placeholder =
                      'data:image/svg+xml;base64,' +
                      btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#666"/><text x="100" y="100" text-anchor="middle" fill="white" font-size="14">737 鼓包示例</text></svg>`);
                    handleSend(s.query, [{ type: 'image', url: placeholder }]);
                  } else {
                    handleSend(s.query);
                  }
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <ChatWindow
            messages={messages}
            isStreaming={isBusy}
            onSend={handleSend}
            onReset={reset}
            error={error}
            retryAttempt={retryAttempt}
          />
        </section>

        <aside className="right">
          {/* P0-3: 转人工结构化摘要（仅当 transfer_handler 输出时显示） */}
          <TransferSummary messages={messages} />
          <SidePanel
            routing={routing}
            tasks={tasks}
            retrievals={retrievals}
            emotions={emotions}
            state={state}
            isStreaming={isStreaming}
          />
        </aside>
      </main>
    </div>
  );
}

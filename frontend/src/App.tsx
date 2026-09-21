import { useState } from 'react';
import { useDifyChat } from './hooks/useDifyChat';
import { useEventParser } from './hooks/useEventParser';
import { extractKeyInfo } from './utils/inference';
import type { UserInsight } from './types';
import ChatWindow from './components/ChatWindow';
import DefenseMatrix from './components/DefenseMatrix';
import SidePanel from './components/SidePanel';
import {
  IconAnkerLogo,
  IconShieldCheck,
} from './components/SvgIcons';

export default function App() {
  const chat = useDifyChat();
  const [collapsedSide, setCollapsedSide] = useState(false);

  // 获取最近的用户与助手消息
  const lastUserMsg = [...chat.messages].reverse().find(m => m.role === 'user');
  const lastAssistantMsg = [...chat.messages].reverse().find(m => m.role === 'assistant');

  const initialQuery = lastUserMsg?.content || '';
  const initialAttachments = lastUserMsg?.attachments;

  // 聚合解析事件与状态
  const { tasks, retrievals, state } = useEventParser({
    events: [],
    initialQuery,
    initialAttachments,
    lastAssistantMessage: lastAssistantMsg,
  });

  // 统计引用的出处数量
  const citationsCount =
    lastAssistantMsg?.retrieverResources?.length ||
    (retrievals.length > 0 ? retrievals[0].results.length : 0);

  // 第四道·权限锁：用户提出退款/赔偿类越权诉求时点亮（规则服务不授予该类权益）
  const privilegeRequested = chat.messages.some(
    m => m.role === 'user' && /退款|退货|赔偿|补偿|退钱|退一赔三/.test(m.content || '')
  );

  // B2 用户辅助气泡：情绪/意图/产品只取服务与模型给的值，关键信息取自用户原话
  const userInsight: UserInsight = {
    emotion: state.emotion,
    intents: state.intents,
    product: state.productModel,
    keyInfo: extractKeyInfo(initialQuery),
  };

  return (
    <div className="anker-workbench-app">
      {/* 1. 顶层全局导航条 */}
      <header className="workbench-top-nav">
        <div className="nav-brand-area">
          <div className="anker-logo-icon">
            <IconAnkerLogo size={24} color="#0084ff" />
          </div>
          <div className="brand-text-group">
            <span className="brand-title">Anker 智能售后 AI 工作台</span>
          </div>
        </div>

        <div className="nav-actions-area">
          <div className="nav-badge-pill">
            <IconShieldCheck size={14} color="#10b981" />
            <span>{chat.connected ? '服务在线' : chat.isStreaming ? '正在推理' : '准备就绪'}</span>
          </div>

          <button
            className="nav-btn collapse-toggle-btn"
            onClick={() => setCollapsedSide(v => !v)}
            title={collapsedSide ? '展开' : '收起'}
          >
            {collapsedSide ? '展开看板 ◨' : '收起看板 ◫'}
          </button>
        </div>
      </header>

      {/* 2. 幻觉四道防线实时监控栏 */}
      <DefenseMatrix
        state={state}
        citationsCount={citationsCount}
        isStreaming={chat.isStreaming}
        privilegeRequested={privilegeRequested}
      />

      {/* 3. 主工作区分割布局 */}
      <main className={`workbench-workspace-main ${collapsedSide ? 'collapsed' : ''}`}>
        {/* 左侧：智能售后会话交互主区 */}
        <section className="chat-column-section" aria-label="售后对话流">
          <ChatWindow
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            onSend={(query, files) => chat.send({ query, files })}
            onReset={chat.reset}
            error={chat.error}
            userInsight={userInsight}
          />
        </section>

        {/* 右侧：处理依据 */}
        {!collapsedSide && (
          <section className="evidence-column-section" aria-label="处理依据">
            <SidePanel
              tasks={tasks}
              state={state}
              attachments={initialAttachments}
              isStreaming={chat.isStreaming}
            />
          </section>
        )}
      </main>
    </div>
  );
}

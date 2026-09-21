import { useState } from 'react';
import type { RoutingStep, TaskItem, RetrievalRecord, EmotionPoint, TroubleshootingState } from '../types';
import VisionInspector, { type VisionTuple } from './VisionInspector';
import AuditTimeline from './AuditTimeline';
import EmotionAuditor from './EmotionAuditor';
import RetrievalLog from './RetrievalLog';
import {
  IconCameraVision,
  IconGitBranch,
  IconChartTrend,
  IconSourceQuote,
  IconFsmProcess,
} from './SvgIcons';

interface Props {
  routing: RoutingStep[];
  tasks: TaskItem[];
  retrievals: RetrievalRecord[];
  emotions: EmotionPoint[];
  state: TroubleshootingState;
  userQuery?: string;
  attachments?: Array<{ type: string; url: string }>;
  isStreaming?: boolean;
  onOpenBenchmark?: () => void;
}

export default function SidePanel({
  routing,
  tasks,
  retrievals,
  emotions,
  state,
  userQuery,
  attachments = [],
  isStreaming,
  onOpenBenchmark,
}: Props) {
  const [activeTab, setActiveTab] = useState<'decision' | 'vision' | 'emotion' | 'retrieval'>('decision');

  // 契约 C：四元组只来自 evidence.vision 的真实数据；
  // 没有数据时交给 VisionInspector 显示"待提取"，不在此处编造型号或置信度。
  const visionData: VisionTuple | undefined = state.visionEvidence;

  return (
    <aside className="audit-side-panel">
      {/* 看板顶栏 */}
      <div className="side-panel-top-bar">
        <div className="panel-title-wrap">
          <IconFsmProcess size={18} color="#0084ff" />
          <span className="panel-main-title">L3 可解释性决策与安全审计看板</span>
        </div>
        <span className="panel-mode-badge">合规审计视界</span>
      </div>

      {/* 看板多维标签导航 */}
      <div className="side-panel-tabs">
        <button
          className={`side-tab-btn ${activeTab === 'decision' ? 'active' : ''}`}
          onClick={() => setActiveTab('decision')}
        >
          <IconGitBranch size={15} />
          <span>决策与路由</span>
          {tasks.length > 0 && <span className="tab-count">{tasks.length}</span>}
        </button>

        <button
          className={`side-tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
          onClick={() => setActiveTab('vision')}
        >
          <IconCameraVision size={15} />
          <span>看图跳级</span>
          {attachments.length > 0 && <span className="tab-count glow">{attachments.length}</span>}
        </button>

        <button
          className={`side-tab-btn ${activeTab === 'emotion' ? 'active' : ''}`}
          onClick={() => setActiveTab('emotion')}
        >
          <IconChartTrend size={15} />
          <span>情绪监测</span>
          {state.emotionLevel && state.emotionLevel !== 'normal' && (
            <span className="tab-count alert">!</span>
          )}
        </button>

        <button
          className={`side-tab-btn ${activeTab === 'retrieval' ? 'active' : ''}`}
          onClick={() => setActiveTab('retrieval')}
        >
          <IconSourceQuote size={15} />
          <span>出处检索</span>
          {retrievals.length > 0 && <span className="tab-count">{retrievals.length}</span>}
        </button>
      </div>

      {/* 选项卡内容区 */}
      <div className="side-panel-content-scroll">
        {activeTab === 'decision' && (
          <AuditTimeline
            state={state}
            routing={routing}
            tasks={tasks}
            userQuery={userQuery}
          />
        )}

        {activeTab === 'vision' && (
          <VisionInspector
            vision={visionData}
            attachments={attachments}
            isStreaming={isStreaming}
            onOpenBenchmark={onOpenBenchmark}
          />
        )}

        {activeTab === 'emotion' && (
          <EmotionAuditor
            emotions={emotions}
            state={state}
          />
        )}

        {activeTab === 'retrieval' && (
          <div className="retrieval-tab-content">
            <div className="retrieval-intro-box">
              <IconSourceQuote size={16} color="#0084ff" />
              <span>
                <strong>出处锁机制：</strong>政策类回答强制依托向量/元数据检索，置信度 &lt; 0.7 触发诚实升级，绝不编造召回或虚构质保。
              </span>
            </div>
            <RetrievalLog retrievals={retrievals} />
          </div>
        )}
      </div>
    </aside>
  );
}

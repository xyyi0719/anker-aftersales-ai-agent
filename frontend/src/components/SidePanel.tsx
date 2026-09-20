/**
 * SidePanel v2 — 所有状态同时显示
 * 顶部 6 张状态卡 + 下面 4 段并列（任务 / 路由 / 情绪 / 检索）
 * 不再 tab 切换
 */

import type { RoutingStep, TaskItem, RetrievalRecord, EmotionPoint, TroubleshootingState } from '../types';
import TaskList from './TaskList';
import RoutingPath from './RoutingPath';
import EmotionChart from './EmotionChart';
import RetrievalLog from './RetrievalLog';
import StatusCards from './StatusCards';

interface Props {
  routing: RoutingStep[];
  tasks: TaskItem[];
  retrievals: RetrievalRecord[];
  emotions: EmotionPoint[];
  state: TroubleshootingState;
  isStreaming?: boolean;
}

export default function SidePanel({ routing, tasks, retrievals, emotions, state, isStreaming }: Props) {
  return (
    <div className="side-panel side-panel-v2">
      {/* 顶部：状态卡片 */}
      <StatusCards state={state} isStreaming={isStreaming} />

      {/* 中部：路由 + 情绪 并列 */}
      <div className="side-panel-row">
        <section className="panel-section">
          <SectionHeader icon="🧭" title="路由时间线" count={routing.length} />
          <div className="panel-section-body">
            <RoutingPath routing={routing} />
          </div>
        </section>
        <section className="panel-section">
          <SectionHeader icon="📈" title="情绪曲线" count={emotions.length} />
          <div className="panel-section-body">
            <EmotionChart emotions={emotions} current={state.emotionLevel} />
          </div>
        </section>
      </div>

      {/* 下部：任务 + 检索 并列 */}
      <div className="side-panel-row">
        <section className="panel-section">
          <SectionHeader icon="✅" title="任务列表" count={tasks.length} />
          <div className="panel-section-body">
            <TaskList tasks={tasks} state={state} />
          </div>
        </section>
        <section className="panel-section">
          <SectionHeader icon="🔍" title="检索日志" count={retrievals.length} />
          <div className="panel-section-body">
            <RetrievalLog retrievals={retrievals} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count }: { icon: string; title: string; count: number }) {
  return (
    <div className="panel-section-header">
      <span className="panel-section-icon">{icon}</span>
      <span className="panel-section-title">{title}</span>
      {count > 0 && <span className="panel-section-count">{count}</span>}
    </div>
  );
}

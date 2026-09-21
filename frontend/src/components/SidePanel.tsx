import type { TaskItem, TroubleshootingState } from '../types';
import SessionSummary from './SessionSummary';
import ProfileProduct from './ProfileProduct';
import TicketFlow from './TicketFlow';

interface Props {
  tasks: TaskItem[];
  state: TroubleshootingState;
  attachments?: Array<{ type: string; url: string }>;
  isStreaming?: boolean;
  conversationId?: string;
  onTransferred?: (ticket: { ticket_id: string; status: string; dispatched?: boolean }) => void;
}

// 右侧三层：#B1 上层=会话摘要与诉求，中层=用户档案+产品信息+处理依据，下层=工单流程。
export default function SidePanel({ tasks, state, attachments = [], isStreaming, conversationId, onTransferred }: Props) {
  return (
    <aside className="evidence-side-panel">
      <div className="panel-layer-scroll">
        <SessionSummary summary={state.summary} tasks={tasks} />
        <ProfileProduct state={state} attachments={attachments} isStreaming={isStreaming} />
        <TicketFlow state={state} conversationId={conversationId} onTransferred={onTransferred} />
      </div>
    </aside>
  );
}

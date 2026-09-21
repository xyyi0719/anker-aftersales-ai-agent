import { IconTicket, IconAlertTriangle, IconCheckCircle } from './SvgIcons';

export interface TicketData {
  ticketId: string;
  slaLevel: 'P0 紧急安全' | 'P1 投诉优先' | 'P2 标准服务';
  product: string;
  problem: string;
  attemptedSteps: string[];
  warrantyStatus: string;
  emotionStatus: string;
  handoffAdvice: string;
  timestamp: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticket: TicketData;
}

export default function HandoffTicketModal({ isOpen, onClose, ticket }: Props) {
  if (!isOpen) return null;

  const isP0 = ticket.slaLevel.startsWith('P0');

  return (
    <div className="handoff-modal-overlay" onClick={onClose}>
      <div className="handoff-modal-card" onClick={e => e.stopPropagation()}>
        <div className="handoff-modal-header">
          <div className="handoff-modal-title">
            <IconTicket size={22} color={isP0 ? '#ef4444' : '#f59e0b'} />
            <div>
              <h3>结构化人工交接工单</h3>
              <p>AI 自动归纳故障上下文与已尝试方案，确保真人客服 0 障碍秒级接单</p>
            </div>
          </div>
          <button className="handoff-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="handoff-meta-strip">
          <div className="meta-cell">
            <span className="meta-k">工单编号</span>
            <span className="meta-v mono">{ticket.ticketId}</span>
          </div>
          <div className="meta-cell">
            <span className="meta-k">SLA 响应等级</span>
            <span className={`meta-v pill ${isP0 ? 'danger' : 'warning'}`}>
              {ticket.slaLevel}
            </span>
          </div>
          <div className="meta-cell">
            <span className="meta-k">生成时间</span>
            <span className="meta-v">{new Date(ticket.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="handoff-modal-body">
          <div className="handoff-section">
            <h4 className="section-label">用户画像与情绪评估</h4>
            <div className="section-card">
              <div className="grid-2">
                <div><strong>关联设备：</strong>{ticket.product}</div>
                <div><strong>情绪状态：</strong><span className="danger-text">{ticket.emotionStatus}</span></div>
                <div><strong>核保判定：</strong>{ticket.warrantyStatus}</div>
              </div>
            </div>
          </div>

          <div className="handoff-section">
            <h4 className="section-label">故障现象归一描述</h4>
            <div className="section-card problem-box">
              {ticket.problem}
            </div>
          </div>

          <div className="handoff-section">
            <h4 className="section-label">AI 已引导排障记录 (避免人工重复质问用户)</h4>
            <div className="section-card">
              {ticket.attemptedSteps.length === 0 ? (
                <span className="text-muted">因触发安全红线/强安抚，前置跳过普通排障</span>
              ) : (
                <ul className="attempted-steps-list">
                  {ticket.attemptedSteps.map((s, i) => (
                    <li key={i}>
                      <IconCheckCircle size={14} color="#10b981" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="handoff-section">
            <h4 className="section-label">转接专员行动建议 (Actionable Advice)</h4>
            <div className="advice-card">
              <IconAlertTriangle size={16} color="#3b82f6" />
              <span>{ticket.handoffAdvice}</span>
            </div>
          </div>
        </div>

        <div className="handoff-modal-footer">
          <span className="footer-tip">已按 Anker 客服 SOP 自动同步模拟工单池</span>
          <button className="handoff-confirm-btn" onClick={onClose}>已确认交接</button>
        </div>
      </div>
    </div>
  );
}

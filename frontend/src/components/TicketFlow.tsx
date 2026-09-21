import { useState } from 'react';
import type { TroubleshootingState } from '../types';
import { transferToAgent } from '../api/actions';

interface Props {
  state: TroubleshootingState;
  conversationId?: string;
  onTransferred?: (ticket: { ticket_id: string; status: string; dispatched?: boolean }) => void;
}

// 措辞纪律：只用未完成态（「待专员接单」「已提交转派申请」），不写「已转派」「专员已接单」，不写时长承诺。
export default function TicketFlow({ state, conversationId, onTransferred }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticket = state.ticket;

  if (!ticket?.ticket_id) {
    return (
      <section className="layer-ticket" aria-label="工单流程">
        <h4 className="block-title">工单流程</h4>
        <p className="ticket-empty">当前无工单</p>
      </section>
    );
  }

  const transferred = ticket.status === 'transfer_requested';
  const steps = [
    { label: '已受理', done: true },
    { label: '已定位故障', done: Boolean(state.productModel || state.currentNode) },
    { label: '已生成工单', done: true, extra: ticket.ticket_id },
    { label: '待专员接单', done: !transferred },
    { label: '已提交转派申请', done: transferred },
  ];

  const handleTransfer = async () => {
    if (submitting || !conversationId) return;
    setSubmitting(true);
    setError(null);
    const res = await transferToAgent(conversationId, ticket.ticket_id);
    setSubmitting(false);
    if (res.ok && res.ticket) {
      // 状态以接口返回为准，前端不自行推进
      onTransferred?.(res.ticket);
    } else {
      setError('提交失败，请重试');
    }
  };

  return (
    <section className="layer-ticket" aria-label="工单流程">
      <h4 className="block-title">工单流程</h4>
      <ol className="ticket-steps">
        {steps.map(s => (
          <li key={s.label} className={`ticket-step ${s.done ? 'done' : 'pending'}`}>
            <span className="ticket-step-mark">{s.done ? '✓' : '○'}</span>
            <span className="ticket-step-label">{s.label}</span>
            {s.extra && <span className="ticket-step-extra">{s.extra}</span>}
          </li>
        ))}
      </ol>
      {!transferred && (
        <button
          type="button"
          className="ticket-action-btn"
          disabled={submitting || !conversationId}
          onClick={handleTransfer}
        >
          {submitting ? '提交中…' : '确认转派'}
        </button>
      )}
      {error && <p className="ticket-error">{error}</p>}
    </section>
  );
}

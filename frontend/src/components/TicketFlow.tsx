import type { TroubleshootingState } from '../types';

interface Props {
  state: TroubleshootingState;
}

// 措辞纪律：只用未完成态，不写「已转派」「专员已接单」，不写时长承诺。
export default function TicketFlow({ state }: Props) {
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
    </section>
  );
}

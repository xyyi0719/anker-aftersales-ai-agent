import type { RoutingStep } from '../types';

interface Props {
  routing: RoutingStep[];
}

const TYPE_ICONS = {
  intent: '🎯',
  emotion: '💢',
  disambiguation: '🔀',
  order: '📦',
  warranty: '🛡',
  troubleshooting: '🔧',
  policy: '📜',
  tool: '⚙',
  escalation: '🚨',
  vision: '👁',
  routing: '🧭',
};

export default function RoutingPath({ routing }: Props) {
  if (routing.length === 0) {
    return <div className="empty-state">路由路径将在对话开始后出现</div>;
  }

  return (
    <div className="routing-path">
      {routing.map(step => (
        <div key={step.id} className={`routing-step ${step.status} ${step.type}`}>
          <div className="routing-dot">{TYPE_ICONS[step.type] || '•'}</div>
          <div className="routing-content">
            <div className="routing-label">{step.label}</div>
            {step.result && <div className="routing-result">{step.result}</div>}
            <div className="routing-time">
              {new Date(step.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
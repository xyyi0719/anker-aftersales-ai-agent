import { useState } from 'react';
import type { EmotionPoint, TroubleshootingState } from '../types';
import { IconChartTrend, IconTicket, IconAlertTriangle } from './SvgIcons';
import HandoffTicketModal, { type TicketData } from './HandoffTicketModal';

interface Props {
  emotions: EmotionPoint[];
  state: TroubleshootingState;
}

const LEVEL_NUM: Record<string, number> = {
  normal: 1,
  upset: 2,
  angry: 3,
  angry_escalated: 3.8,
  complaint: 4,
};

const LEVEL_COLORS: Record<string, string> = {
  normal: '#10b981',
  upset: '#f59e0b',
  angry: '#ef4444',
  angry_escalated: '#dc2626',
  complaint: '#ec4899',
};

const LEVEL_NAMES: Record<string, string> = {
  normal: '平静',
  upset: '不满',
  angry: '暴怒',
  angry_escalated: '暴怒升级',
  complaint: '投诉风险',
};

const INTENSITY_NAMES: Record<string, string> = {
  L0_none: '常规答复 (未触发安抚)',
  L1_mild: '轻度共情话术 (L1)',
  L2_strong: '强安抚与主动优先通道 (L2)',
  L3_priority: '最高警报 · 立即升级转人工 (L3)',
};

export default function EmotionAuditor({ emotions, state }: Props) {
  const [showModal, setShowModal] = useState(false);

  const points = emotions.length > 0 ? emotions : [{ timestamp: Date.now(), level: state.emotionLevel || 'normal' }];
  const currentLevel = state.emotionLevel || 'normal';
  const intensity = state.emotionIntensity || (
    currentLevel === 'complaint' || currentLevel === 'angry_escalated'
      ? 'L3_priority'
      : currentLevel === 'angry'
      ? 'L2_strong'
      : currentLevel === 'upset'
      ? 'L1_mild'
      : 'L0_none'
  );

  const isEscalated =
    currentLevel === 'complaint' ||
    currentLevel === 'angry' ||
    currentLevel === 'angry_escalated' ||
    (state.consecutiveAngry ?? 0) >= 2;

  // SVG 坐标计算
  const width = 340;
  const height = 120;
  const padX = 24;
  const padY = 16;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const val = LEVEL_NUM[p.level] || 1;
    const x = padX + i * stepX;
    const y = height - padY - ((val - 1) / 3) * chartH;
    return { x, y, level: p.level, trigger: p.trigger };
  });

  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaD = coords.length > 1
    ? `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padY} L ${coords[0].x.toFixed(1)} ${height - padY} Z`
    : '';

  // 构建模拟交接工单
  const ticketData: TicketData = {
    ticketId: `ANK-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`,
    slaLevel: isEscalated ? 'P0 紧急安全' : 'P1 投诉优先',
    product: state.productModel || 'Anker 737 移动电源',
    problem: state.currentNode || '充电故障 / 接触不良引起用户多次受挫',
    attemptedSteps: state.path.map(p => `${p.node} → ${p.choice}`),
    warrantyStatus: '在保中 (由订单 SN 自动比对判定)',
    emotionStatus: `${LEVEL_NAMES[currentLevel]} · ${state.consecutiveAngry ? `已连续 ${state.consecutiveAngry} 轮暴怒` : '单轮激化'}`,
    handoffAdvice: isEscalated
      ? '用户已产生强烈不满与投诉倾向，已给出安抚预案，请真人客服接通后直接确认换新或极速补偿，切勿要求用户重试已做过的换线排查。'
      : '请温和跟进用户排障反馈。',
    timestamp: Date.now(),
  };

  return (
    <div className="emotion-auditor-card">
      <div className="emotion-card-top">
        <div className="emotion-header-title">
          <IconChartTrend size={18} color="#f59e0b" />
          <span>情绪分层递进与安抚监测</span>
        </div>
        <span className={`emotion-current-tag ${currentLevel}`}>
          {LEVEL_NAMES[currentLevel] || currentLevel}
        </span>
      </div>

      {/* 安抚档位状态条 */}
      <div className={`empathy-intensity-box ${intensity}`}>
        <div className="empathy-intensity-left">
          <span className="empathy-dot" />
          <span className="empathy-label">{INTENSITY_NAMES[intensity]}</span>
        </div>
        {state.consecutiveAngry && state.consecutiveAngry >= 2 && (
          <span className="empathy-badge-alert">连续 {state.consecutiveAngry} 次暴怒</span>
        )}
      </div>

      {/* SVG 情绪变化曲线 */}
      <div className="emotion-chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="emotion-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 背景网格参考线 */}
          {[1, 2, 3, 4].map(level => {
            const y = height - padY - ((level - 1) / 3) * chartH;
            return (
              <g key={level}>
                <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <text x={padX - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="9">
                  {level === 1 ? '平' : level === 2 ? '烦' : level === 3 ? '怒' : '诉'}
                </text>
              </g>
            );
          })}

          {/* 渐变填充 */}
          {areaD && <path d={areaD} fill="url(#emotionGradient)" />}

          {/* 折线 */}
          {lineD && <path d={lineD} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

          {/* 数据点 */}
          {coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={i === coords.length - 1 ? 5 : 3.5}
              fill={LEVEL_COLORS[c.level] || '#38bdf8'}
              stroke="#0f172a"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>

      {/* 结构化人工交接触发条 */}
      {isEscalated && (
        <div className="handoff-trigger-banner">
          <div className="handoff-banner-text">
            <IconAlertTriangle size={16} color="#ef4444" />
            <span>检测到高风险情绪，已自动生成交接工单</span>
          </div>
          <button className="handoff-open-btn" onClick={() => setShowModal(true)}>
            <IconTicket size={14} />
            <span>查看交接摘要</span>
          </button>
        </div>
      )}

      {/* 交接工单模态窗 */}
      <HandoffTicketModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        ticket={ticketData}
      />
    </div>
  );
}

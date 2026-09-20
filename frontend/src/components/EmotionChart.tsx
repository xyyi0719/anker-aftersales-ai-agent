import type { EmotionPoint } from '../types';

interface Props {
  emotions: EmotionPoint[];
  current?: 'normal' | 'upset' | 'angry' | 'complaint' | 'angry_escalated';
  history?: Array<{ level: string; trigger: string; query: string }>;
  consecutiveAngry?: number;
}

const LEVEL_VALUE: Record<string, number> = {
  normal: 1,
  upset: 2,
  angry: 3,
  angry_escalated: 3.7, // angry + 升级提示
  complaint: 4,
};

const LEVEL_COLOR: Record<string, string> = {
  normal: '#00c896',
  upset: '#ff9e00',
  angry: '#ff4757',
  angry_escalated: '#dc2626',
  complaint: '#ff1493',
};

const LEVEL_LABEL: Record<string, string> = {
  normal: '正常',
  upset: '不满',
  angry: '暴怒',
  angry_escalated: '暴怒·升级',
  complaint: '投诉风险',
};

// 安抚强度档位（来自 empathy_responses.yaml）
const INTENSITY_LABEL: Record<string, string> = {
  L0_none: '未触发',
  L1_mild: '轻度安抚',
  L2_strong: '强安抚',
  L3_priority: '优先通道',
};

const INTENSITY_EMOJI: Record<string, string> = {
  L0_none: '',
  L1_mild: '🤝',
  L2_strong: '🤗',
  L3_priority: '🚨',
};

export default function EmotionChart({ emotions, current, history = [], consecutiveAngry }: Props) {
  const points = emotions.length > 0 ? emotions : [
    { timestamp: Date.now(), level: current || 'normal' },
  ];

  // 决定当前强度档位
  const currentLevel = current || 'normal';
  const intensity =
    currentLevel === 'complaint' ? 'L3_priority' :
    currentLevel === 'angry_escalated' ? 'L3_priority' :
    currentLevel === 'angry' ? 'L2_strong' :
    currentLevel === 'upset' ? 'L1_mild' :
    'L0_none';

  const width = 360;
  const height = 200;
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2 - 30;

  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  const pathD = points
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = height - padding - 30 - (LEVEL_VALUE[p.level] / 4) * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // 安抚点标记 - angry/complaint 等级标记为安抚点
  const empathyPoints = points.map((p, i) => {
    const level = p.level;
    const isEmpathy = level === 'angry' || level === 'angry_escalated' || level === 'complaint';
    const intensity = level === 'complaint' ? 'L3_priority' : level === 'angry_escalated' ? 'L3_priority' : level === 'angry' ? 'L2_strong' : null;
    return { x: padding + i * stepX, y: height - padding - 30 - (LEVEL_VALUE[level] / 4) * chartHeight, isEmpathy, intensity };
  });

  return (
    <div>
      {/* 当前情绪卡片 */}
      <div className="emotion-summary">
        <h4>当前情绪等级</h4>
        <div className={`emotion-current emotion-${current || 'normal'}`}>
          {LEVEL_LABEL[current || 'normal'] || current}
        </div>
        {points.length > 0 && points[points.length - 1].trigger && (
          <div className="emotion-trigger">
            触发：{points[points.length - 1].trigger?.slice(0, 30)}
          </div>
        )}
        {/* H4-完整: 安抚强度档位 */}
        <div className={`empathy-intensity empathy-${intensity}`}>
          {INTENSITY_EMOJI[intensity]} 安抚强度: {INTENSITY_LABEL[intensity]}
          {consecutiveAngry && consecutiveAngry >= 2 && (
            <span className="empathy-badge"> 连续{consecutiveAngry}次暴怒 · 升级</span>
          )}
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>情绪变化曲线</div>

      <div className="emotion-chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* 网格线 */}
          {[1, 2, 3, 4].map(level => {
            const y = height - padding - 30 - (level / 4) * chartHeight;
            return (
              <g key={level}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#2d3548"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding - 4}
                  y={y + 4}
                  textAnchor="end"
                  fill="#5a6378"
                  fontSize="9"
                >
                  {LEVEL_LABEL[Object.keys(LEVEL_VALUE).find(k => LEVEL_VALUE[k] === level) as keyof typeof LEVEL_LABEL] || ''}
                </text>
              </g>
            );
          })}

          {/* 折线 */}
          {points.length > 1 && (
            <path
              d={pathD}
              stroke="#0084ff"
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
            />
          )}

          {/* 圆点 */}
          {points.map((p, i) => {
            const x = padding + i * stepX;
            const y = height - padding - 30 - (LEVEL_VALUE[p.level] / 4) * chartHeight;
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill={LEVEL_COLOR[p.level]}
                  stroke="#0f1419"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* H4-完整: 安抚点星标 */}
          {empathyPoints.map((p, i) => p.isEmpathy && (
            <g key={`emp-${i}`}>
              {/* 星标外圈 */}
              <circle cx={p.x} cy={p.y} r="10" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.7" />
              {/* 🤗 emoji-like 标记 */}
              <text
                x={p.x}
                y={p.y + 3}
                textAnchor="middle"
                fontSize="10"
                fill="#fbbf24"
                fontWeight="bold"
              >
                {p.intensity === 'L3_priority' ? '🚨' : '🤗'}
              </text>
            </g>
          ))}

          {/* 图例 */}
          <g transform={`translate(${padding}, ${height - 12})`}>
            <text x="0" y="0" fontSize="10" fill="#5a6378">🤗 = 安抚点</text>
            <text x="80" y="0" fontSize="10" fill="#5a6378">🚨 = 升级点</text>
            <text x="160" y="0" fontSize="10" fill="#5a6378">{history.length} 轮历史</text>
          </g>
        </svg>
      </div>

      {/* H4-完整: 情绪历史轨迹 */}
      {history.length > 0 && (
        <div className="emotion-history">
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>近 5 轮情绪轨迹</div>
          <div className="emotion-history-list">
            {history.slice(-5).map((h, i) => (
              <div key={i} className={`emotion-history-item emotion-${h.level}`}>
                <span className="emotion-history-dot" style={{ background: LEVEL_COLOR[h.level] || '#888' }}></span>
                <span className="emotion-history-level">{LEVEL_LABEL[h.level] || h.level}</span>
                <span className="emotion-history-trigger">{h.trigger || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {points.length > 0 && !history.length && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
          最近 {points.length} 个情绪点
        </div>
      )}
    </div>
  );
}
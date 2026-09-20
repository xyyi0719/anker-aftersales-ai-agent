import type { EmotionPoint } from '../types';

interface Props {
  emotions: EmotionPoint[];
  current?: 'normal' | 'upset' | 'angry' | 'complaint';
}

const LEVEL_VALUE = {
  normal: 1,
  upset: 2,
  angry: 3,
  complaint: 4,
};

const LEVEL_COLOR = {
  normal: '#00c896',
  upset: '#ff9e00',
  angry: '#ff4757',
  complaint: '#ff1493',
};

const LEVEL_LABEL = {
  normal: '正常',
  upset: '不满',
  angry: '暴怒',
  complaint: '投诉风险',
};

export default function EmotionChart({ emotions, current }: Props) {
  const points = emotions.length > 0 ? emotions : [
    { timestamp: Date.now(), level: current || 'normal' },
  ];

  const width = 360;
  const height = 160;
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  const pathD = points
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (LEVEL_VALUE[p.level] / 4) * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div>
      {/* 当前情绪卡片 */}
      <div className="emotion-summary">
        <h4>当前情绪等级</h4>
        <div className={`emotion-current emotion-${current || 'normal'}`}>
          {LEVEL_LABEL[current || 'normal']}
        </div>
        {points.length > 0 && points[points.length - 1].trigger && (
          <div className="emotion-trigger">
            触发：{points[points.length - 1].trigger?.slice(0, 30)}
          </div>
        )}
      </div>

      <div style={{ height: 12 }} />

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>情绪变化曲线</div>

      <div className="emotion-chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* 网格线 */}
          {[1, 2, 3, 4].map(level => {
            const y = height - padding - (level / 4) * chartHeight;
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
                  {LEVEL_LABEL[Object.keys(LEVEL_VALUE).find(k => LEVEL_VALUE[k as keyof typeof LEVEL_VALUE] === level) as keyof typeof LEVEL_LABEL] || ''}
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
            const y = height - padding - (LEVEL_VALUE[p.level] / 4) * chartHeight;
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
        </svg>
      </div>

      {points.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
          最近 {points.length} 个情绪点
        </div>
      )}
    </div>
  );
}
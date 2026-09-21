import type { RoutingStep, TaskItem, TroubleshootingState } from '../types';
import {
  IconGitBranch,
  IconCheckCircle,
  IconFsmProcess,
  IconSourceQuote,
  IconShieldCheck,
} from './SvgIcons';

interface Props {
  state: TroubleshootingState;
  routing: RoutingStep[];
  tasks: TaskItem[];
  userQuery?: string;
}

const COLLOQUIAL_MAP: Array<{ match: RegExp; standard: string; category: string }> = [
  { match: /充不进|无法充电|不进电|不能充/i, standard: '充电故障 / 供电握手失败', category: '硬件供电' },
  { match: /不吸|吸不住|吸不出|吸力/i, standard: '负压泵故障 / 气密性失效', category: '动力机械' },
  { match: /一边响|单边|没声音|单耳/i, standard: '声道平衡失常 / 蓝牙单耳断连', category: '音频传输' },
  { match: /鼓包|起火|发烫|发热严重|爆炸/i, standard: '电芯物理损伤 / 安全过热险情', category: '安全隐患' },
  { match: /退货|退款|不要了/i, standard: '逆向物流 / 7天无理由或渠道退换', category: '商户政策' },
  { match: /保修|多久|质保|保修期/i, standard: '保修范围确认 / SN码周期核对', category: '质保权益' },
  { match: /召回|爆炸过吗|有毛病/i, standard: '合规召回查询 / 官方公告检索', category: '合规公关' },
];

export default function AuditTimeline({ state, routing, tasks, userQuery }: Props) {
  // 匹配口语归一化
  const matchedNormalization = userQuery
    ? COLLOQUIAL_MAP.find(m => m.match.test(userQuery))
    : null;

  // 提取政策路由特征
  const detectedChannel = userQuery?.includes('亚马逊') || userQuery?.includes('amazon')
    ? 'Amazon 专营渠道'
    : userQuery?.includes('天猫') || userQuery?.includes('京东')
    ? '国内电商 (天猫/京东)'
    : 'Anker 官方商城';

  const detectedRegion = userQuery?.includes('国行') || userQuery?.includes('国内')
    ? '中国大陆 (三包政策)'
    : '北美区域 (US Warranty)';

  return (
    <div className="audit-timeline-component">
      {/* 1. 口语归一化转换指示条 */}
      {matchedNormalization && (
        <div className="colloquial-conversion-bar">
          <div className="colloquial-badge-label">口语归一化</div>
          <div className="colloquial-body">
            <span className="colloquial-user-text">"{userQuery?.slice(0, 18)}..."</span>
            <span className="colloquial-arrow">→</span>
            <span className="colloquial-standard-tag">
              <span className="dot" /> {matchedNormalization.standard}
            </span>
            <span className="colloquial-category-pill">{matchedNormalization.category}</span>
          </div>
        </div>
      )}

      {/* 2. 政策路由与意图分流矩阵 */}
      <div className="policy-routing-block">
        <div className="block-header">
          <IconGitBranch size={16} color="#0084ff" />
          <span className="block-title">政策路由分支判决</span>
          <span className="block-pill">JSON 规则驱动</span>
        </div>
        <div className="routing-matrix-card">
          <div className="routing-params-row">
            <div className="routing-param">
              <span className="param-k">购买渠道</span>
              <span className="param-v">{detectedChannel}</span>
            </div>
            <div className="routing-param">
              <span className="param-k">服务区域</span>
              <span className="param-v">{detectedRegion}</span>
            </div>
            <div className="routing-param">
              <span className="param-k">目标品类</span>
              <span className="param-v">{state.productCategory || state.productModel || '737/Soundcore'}</span>
            </div>
          </div>
          <div className="routing-conclusion-box">
            <div className="conclusion-tag">SOP 路由分支</div>
            <div className="conclusion-text">
              {detectedChannel.includes('Amazon')
                ? '【Amazon政策】平台直营订单：退款请联系亚马逊客服，售后维修换新由安克品牌直属质保团队承接。'
                : '【官网直保政策】支持 18~24 个月有限质保，全流程免运费寄修与性能故障换新。'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 多意图任务流水线 */}
      <div className="tasks-pipeline-block">
        <div className="block-header">
          <IconCheckCircle size={16} color="#10b981" />
          <span className="block-title">多意图分解与并行任务跟踪</span>
          <span className="block-pill">{tasks.length > 0 ? `${tasks.length} 项拆解` : '准备中'}</span>
        </div>

        {tasks.length === 0 ? (
          <div className="tasks-empty-card">
            <p>当用户在一句话中提出多项诉求（如同时要求“查保修”与“排障”）时，系统自动拆解为并行任务。</p>
          </div>
        ) : (
          <div className="tasks-cards-list">
            {tasks.map((task, idx) => {
              const isDone = task.status === 'completed';
              const isInProgress = task.status === 'in_progress';
              return (
                <div key={task.id || idx} className={`task-stream-card ${task.status}`}>
                  <div className="task-status-indicator">
                    {isDone ? (
                      <IconCheckCircle size={14} color="#10b981" />
                    ) : isInProgress ? (
                      <span className="spinner-mini" />
                    ) : (
                      <span className="circle-pending" />
                    )}
                  </div>
                  <div className="task-stream-content">
                    <div className="task-stream-title-row">
                      <span className="task-stream-title">{task.title}</span>
                      <span className={`task-stream-pill ${task.status}`}>
                        {isDone ? '已达成' : isInProgress ? '推进中' : '等待'}
                      </span>
                    </div>
                    {task.detail && <p className="task-stream-detail">{task.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 排障状态机流转足迹 */}
      <div className="fsm-stepper-block">
        <div className="block-header">
          <IconFsmProcess size={16} color="#8b5cf6" />
          <span className="block-title">有限状态机 (FSM) 排障路径</span>
          <span className="block-pill">{state.path.length} 步记录</span>
        </div>
        <div className="fsm-stepper-container">
          {state.path.length === 0 ? (
            <div className="fsm-empty-hint">当前会话尚未进入多轮排障环节</div>
          ) : (
            <div className="fsm-steps-flow">
              {state.path.map((step, i) => (
                <div key={i} className="fsm-step-item">
                  <div className="fsm-step-node">
                    <span className="fsm-step-index">{i + 1}</span>
                    <span className="fsm-step-name">{step.node}</span>
                  </div>
                  <div className="fsm-step-decision">
                    <span className="fsm-decision-badge">{step.choice}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

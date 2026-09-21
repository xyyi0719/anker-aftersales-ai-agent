import { useEffect, useRef, useState } from 'react';
import type { TroubleshootingState } from '../types';
import {
  IconFsmProcess,
  IconSourceQuote,
  IconConfidenceGauge,
  IconPermissionGuard,
  IconShieldCheck,
  IconAlertTriangle,
} from './SvgIcons';

interface Props {
  state: TroubleshootingState;
  citationsCount: number;
  isStreaming?: boolean;
}

export default function DefenseMatrix({ state, citationsCount, isStreaming }: Props) {
  const [pulseLock, setPulseLock] = useState<string | null>(null);
  const prevNode = useRef(state.currentNode);
  const prevCitations = useRef(citationsCount);
  const prevEmotion = useRef(state.emotionLevel);

  useEffect(() => {
    if (prevNode.current !== state.currentNode && state.currentNode) {
      setPulseLock('process');
      const timer = setTimeout(() => setPulseLock(null), 1000);
      prevNode.current = state.currentNode;
      return () => clearTimeout(timer);
    }
  }, [state.currentNode]);

  useEffect(() => {
    if (prevCitations.current !== citationsCount && citationsCount > 0) {
      setPulseLock('source');
      const timer = setTimeout(() => setPulseLock(null), 1000);
      prevCitations.current = citationsCount;
      return () => clearTimeout(timer);
    }
  }, [citationsCount]);

  useEffect(() => {
    if (prevEmotion.current !== state.emotionLevel && state.emotionLevel) {
      setPulseLock('confidence');
      const timer = setTimeout(() => setPulseLock(null), 1000);
      prevEmotion.current = state.emotionLevel;
      return () => clearTimeout(timer);
    }
  }, [state.emotionLevel]);

  // 判断置信度状态
  const isAdversarialOrLowConf =
    state.intent === 'out_of_scope' ||
    (state.currentNode && state.currentNode.includes('诚实升级')) ||
    (state.action && state.action.includes('fallback'));

  return (
    <div className="defense-matrix-bar">
      <div className="defense-matrix-header">
        <div className="defense-title-group">
          <IconShieldCheck size={20} color="#10b981" />
          <span className="defense-header-title">幻觉四道防线实时监控</span>
          <span className="defense-badge-live">L3 审计在线</span>
        </div>
        <div className="defense-meta-status">
          {isStreaming ? (
            <span className="defense-status-pulse streaming">
              <span className="dot" /> 状态机运算中...
            </span>
          ) : (
            <span className="defense-status-pulse active">
              <span className="dot" /> 四道防线全时锁闭
            </span>
          )}
        </div>
      </div>

      <div className="defense-cards-grid">
        {/* 1. 流程锁 */}
        <div className={`defense-card ${pulseLock === 'process' ? 'card-pulse' : ''}`}>
          <div className="defense-card-top">
            <span className="defense-icon-badge process">
              <IconFsmProcess size={16} />
            </span>
            <span className="defense-lock-name">第一道 · 流程锁</span>
            <span className="defense-status-pill success">FSM控权</span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">
              {state.currentNode ? state.currentNode : isStreaming ? '节点推演中' : '根节点就绪'}
            </span>
            <span className="defense-sub-desc">
              {state.path.length > 0 ? `已固化推进 ${state.path.length} 步 · 杜绝自由跨步` : '有限状态机决策 · 模型无跨级权'}
            </span>
          </div>
        </div>

        {/* 2. 出处锁 */}
        <div className={`defense-card ${pulseLock === 'source' ? 'card-pulse' : ''}`}>
          <div className="defense-card-top">
            <span className="defense-icon-badge source">
              <IconSourceQuote size={16} />
            </span>
            <span className="defense-lock-name">第二道 · 出处锁</span>
            <span className="defense-status-pill info">
              {citationsCount > 0 ? `引用 ${citationsCount} 条` : '政策库待查'}
            </span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">
              {citationsCount > 0 ? '已锚定官方条款' : '切片元数据严校'}
            </span>
            <span className="defense-sub-desc">
              条款按边界切片 · 支持逐字溯源核对
            </span>
          </div>
        </div>

        {/* 3. 置信度锁 */}
        <div className={`defense-card ${isAdversarialOrLowConf ? 'defense-card-warn' : ''} ${pulseLock === 'confidence' ? 'card-pulse' : ''}`}>
          <div className="defense-card-top">
            <span className="defense-icon-badge confidence">
              {isAdversarialOrLowConf ? (
                <IconAlertTriangle size={16} color="#f59e0b" />
              ) : (
                <IconConfidenceGauge size={16} />
              )}
            </span>
            <span className="defense-lock-name">第三道 · 置信度锁</span>
            <span className={`defense-status-pill ${isAdversarialOrLowConf ? 'warning' : 'success'}`}>
              {isAdversarialOrLowConf ? '触发防御' : '门限 ≥ 0.75'}
            </span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">
              {isAdversarialOrLowConf ? '触发诚实升级' : '置信度达标'}
            </span>
            <span className="defense-sub-desc">
              {isAdversarialOrLowConf ? '检索无据拒答转专员 · 绝不瞎编' : '未知即一等公民 · 阻断虚构回答'}
            </span>
          </div>
        </div>

        {/* 4. 权限锁 */}
        <div className="defense-card">
          <div className="defense-card-top">
            <span className="defense-icon-badge permission">
              <IconPermissionGuard size={16} />
            </span>
            <span className="defense-lock-name">第四道 · 权限锁</span>
            <span className="defense-status-pill neutral">显式授权</span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">
              {state.toolCalls.length > 0 ? `已调用 ${state.toolCalls.length} 次工具` : '只挂载合规API'}
            </span>
            <span className="defense-sub-desc">
              退款/补偿权限隔离 · 阻断越权承诺
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

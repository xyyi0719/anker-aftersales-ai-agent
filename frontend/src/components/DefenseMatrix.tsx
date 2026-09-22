import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
  /** 用户是否提出退款/赔偿类越权诉求（第四道·权限锁的触发信号） */
  privilegeRequested?: boolean;
}

// 每道防线的强调色：走到这一关时卡片微亮 + 上抬
const ACCENT: Record<string, { color: string; soft: string }> = {
  process: { color: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.10)' },
  source: { color: '#0084ff', soft: 'rgba(0, 132, 255, 0.10)' },
  confidence: { color: '#f59e0b', soft: 'rgba(245, 158, 11, 0.10)' },
  permission: { color: '#38bdf8', soft: 'rgba(56, 189, 248, 0.10)' },
};

function accentStyle(key: string): CSSProperties {
  const a = ACCENT[key];
  const vars: Record<string, string> = { '--accent': a.color, '--accent-soft': a.soft };
  return vars as unknown as CSSProperties;
}

export default function DefenseMatrix({ state, citationsCount, isStreaming, privilegeRequested = false }: Props) {
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

  // 四道防线：走到哪一关，哪一关的卡片微亮并上抬
  const flowTriggered = state.path.length > 0;
  const sourceTriggered = citationsCount > 0;
  const confidenceTriggered = Boolean(isAdversarialOrLowConf);
  const triggeredCount = [flowTriggered, sourceTriggered, confidenceTriggered, privilegeRequested].filter(Boolean).length;

  return (
    <div className="defense-matrix-bar">
      <div className="defense-matrix-header">
        <div className="defense-title-group">
          <IconShieldCheck size={20} color="#10b981" />
          <span className="defense-header-title">幻觉四道防线实时监控</span>
        </div>
        <div className="defense-meta-status">
          {isStreaming ? (
            <span className="defense-status-pulse streaming">
              <span className="dot" /> 运算中...
            </span>
          ) : (
            <span className="defense-status-pulse active">
              <span className="dot" /> {triggeredCount > 0 ? `第 ${triggeredCount} 道已触发` : '全部正常'}
            </span>
          )}
        </div>
      </div>

      <div className="defense-cards-grid">
        {/* 1. 流程锁 */}
        <div
          className={`defense-card ${flowTriggered ? 'is-active' : ''} ${pulseLock === 'process' ? 'card-pulse' : ''}`}
          style={accentStyle('process')}
        >
          <div className="defense-card-top">
            <span className="defense-icon-badge process">
              <IconFsmProcess size={16} />
            </span>
            <span className="defense-lock-name">第一道 · 流程锁</span>
            <span className="defense-status-pill success">{flowTriggered ? '已推进' : '正常'}</span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">
              {state.currentNode ? state.currentNode : isStreaming ? '推演中' : '就绪'}
            </span>
          </div>
        </div>

        {/* 2. 出处锁 */}
        <div
          className={`defense-card ${sourceTriggered ? 'is-active' : ''} ${pulseLock === 'source' ? 'card-pulse' : ''}`}
          style={accentStyle('source')}
        >
          <div className="defense-card-top">
            <span className="defense-icon-badge source">
              <IconSourceQuote size={16} />
            </span>
            <span className="defense-lock-name">第二道 · 出处锁</span>
            <span className="defense-status-pill info">
              {sourceTriggered ? `引用 ${citationsCount} 条` : '正常'}
            </span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">{sourceTriggered ? '已引用' : '正常'}</span>
          </div>
        </div>

        {/* 3. 置信度锁 */}
        <div
          className={`defense-card ${confidenceTriggered ? 'is-active' : ''} ${pulseLock === 'confidence' ? 'card-pulse' : ''}`}
          style={accentStyle('confidence')}
        >
          <div className="defense-card-top">
            <span className="defense-icon-badge confidence">
              {confidenceTriggered ? (
                <IconAlertTriangle size={16} color="#f59e0b" />
              ) : (
                <IconConfidenceGauge size={16} />
              )}
            </span>
            <span className="defense-lock-name">第三道 · 置信度锁</span>
            <span className={`defense-status-pill ${confidenceTriggered ? 'warning' : 'success'}`}>
              {confidenceTriggered ? '已升级' : '正常'}
            </span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">{confidenceTriggered ? '已升级' : '正常'}</span>
          </div>
        </div>

        {/* 4. 权限锁 */}
        <div
          className={`defense-card ${privilegeRequested ? 'is-active' : ''}`}
          style={accentStyle('permission')}
        >
          <div className="defense-card-top">
            <span className="defense-icon-badge permission">
              <IconPermissionGuard size={16} />
            </span>
            <span className="defense-lock-name">第四道 · 权限锁</span>
            <span className="defense-status-pill neutral">{privilegeRequested ? '已阻断' : '正常'}</span>
          </div>
          <div className="defense-card-main">
            <span className="defense-main-value">{privilegeRequested ? '已阻断' : '正常'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

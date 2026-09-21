import { IconCameraVision, IconSkipAhead, IconCheckCircle, IconAlertTriangle } from './SvgIcons';

export interface VisionTuple {
  product_model?: string;
  fault_location?: string;
  fault_phenomenon?: string;
  confidence?: number;
  is_anker_product?: boolean;
}

interface Props {
  vision?: VisionTuple;
  attachments?: Array<{ type: string; url: string }>;
  isStreaming?: boolean;
  onOpenBenchmark?: () => void;
}

export default function VisionInspector({ vision, attachments = [], isStreaming, onOpenBenchmark }: Props) {
  const hasImage = attachments.length > 0;
  const isConfidenceHigh = (vision?.confidence ?? 0) >= 0.75;
  const isSafetyRisk =
    vision?.fault_phenomenon?.includes('鼓包') ||
    vision?.fault_phenomenon?.includes('起火') ||
    vision?.fault_phenomenon?.includes('烧灼');

  return (
    <div className="vision-inspector-card">
      <div className="vision-card-header">
        <div className="vision-header-title">
          <IconCameraVision size={18} color="#0084ff" />
          <span>看图办事 · 结构化四元组提取</span>
        </div>
        {onOpenBenchmark && (
          <button className="vision-benchmark-btn" onClick={onOpenBenchmark} title="查看12张基准测试集">
            <span>12张测试图集</span>
          </button>
        )}
      </div>

      {!hasImage && !vision ? (
        <div className="vision-empty-box">
          <IconCameraVision size={32} color="#64748b" />
          <p className="vision-empty-text">
            用户上传故障图后，自动提取「型号/部位/现象/置信度」四元组，并驱动排障树跳级。
          </p>
          {onOpenBenchmark && (
            <button className="vision-empty-action" onClick={onOpenBenchmark}>
              从 12 张基准测试集载入示例图 ↗
            </button>
          )}
        </div>
      ) : (
        <div className="vision-content-body">
          {/* 图片预览栏 */}
          {attachments.length > 0 && (
            <div className="vision-thumbnails-row">
              {attachments.map((img, i) => (
                <div key={i} className="vision-thumb-wrap">
                  <img src={img.url} alt={`上传图片 ${i + 1}`} className="vision-thumb-img" />
                  <span className="vision-thumb-badge">图 {i + 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* 四元组参数卡 */}
          <div className="vision-tuple-grid">
            <div className="tuple-item">
              <span className="tuple-label">产品型号</span>
              <span className="tuple-value highlight">
                {vision?.product_model || (isStreaming ? '识别中...' : '待提取')}
              </span>
            </div>
            <div className="tuple-item">
              <span className="tuple-label">故障部位</span>
              <span className="tuple-value">
                {vision?.fault_location || (isStreaming ? '定位中...' : '待确认')}
              </span>
            </div>
            <div className="tuple-item">
              <span className="tuple-label">故障现象</span>
              <span className={`tuple-value ${isSafetyRisk ? 'danger' : ''}`}>
                {vision?.fault_phenomenon || (isStreaming ? '分析中...' : '待确认')}
              </span>
            </div>
            <div className="tuple-item">
              <span className="tuple-label">提取置信度</span>
              <span className={`tuple-value ${isConfidenceHigh ? 'success' : 'muted'}`}>
                {typeof vision?.confidence === 'number'
                  ? `${(vision.confidence * 100).toFixed(0)}%`
                  : isStreaming
                  ? '测算中...'
                  : '—'}
              </span>
            </div>
          </div>

          {/* 排障树跳级动效通知 */}
          {isConfidenceHigh && vision?.fault_phenomenon && (
            <div className={`vision-skip-banner ${isSafetyRisk ? 'safety' : 'skip'}`}>
              <div className="skip-banner-icon">
                {isSafetyRisk ? <IconAlertTriangle size={18} /> : <IconSkipAhead size={18} />}
              </div>
              <div className="skip-banner-text">
                <span className="skip-title">
                  {isSafetyRisk ? '🚨 安全高危故障 · 紧急终止排障' : '⚡ 视觉置信度达标 · 排障树已跳级'}
                </span>
                <span className="skip-desc">
                  {isSafetyRisk
                    ? '检测到电芯物理形变/高温险情，系统已拦截普通换线流程，直升 P0 人工专员工单'
                    : `图片已确认「${vision.fault_phenomenon}」，自动跳过线材与基础核验，直达关键处理`}
                </span>
              </div>
            </div>
          )}

          {vision?.is_anker_product === false && (
            <div className="vision-skip-banner boundary">
              <div className="skip-banner-icon">
                <IconCheckCircle size={18} color="#f59e0b" />
              </div>
              <div className="skip-banner-text">
                <span className="skip-title">非 Anker 生态产品 · 边界拒答生效</span>
                <span className="skip-desc">
                  图像识别判定为竞品设备，Agent 诚实提示服务范围，拒绝无关答复。
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
